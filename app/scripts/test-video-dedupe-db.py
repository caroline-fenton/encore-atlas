"""Replay migrations and test concurrent RPCs in a disposable Docker Postgres DB.

Usage: python3 scripts/test-video-dedupe-db.py <local-postgres-container>
Creates and drops only its uniquely named test database. Never connects remotely.
The container needs PostgreSQL 17 and createdb/psql/dropdb on PATH.
"""
import json
import pathlib
import subprocess
import sys
import time
import uuid

root = pathlib.Path(__file__).resolve().parents[1]
container = sys.argv[1]
database = 'encore_dedupe_' + uuid.uuid4().hex[:12]
base = ['docker', 'exec', '-i', container]
psql = base + ['psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', database]


def sql(text):
    try:
        return subprocess.check_output(psql, input=text, text=True, stderr=subprocess.STDOUT).strip()
    except subprocess.CalledProcessError as error:
        raise AssertionError(error.output) from error


def candidate(category):
    return json.dumps([dict(youtube_video_id='overlap', title='fixture',
                           search_query='fixture', display_order=0, video_type=category)])


def rpc(artist, category):
    return "select public.upsert_public_build_videos('%s', '%s', '%s');" % (artist, candidate(category), category)


def wait_for_blocked():
    deadline = time.monotonic() + 10
    while time.monotonic() < deadline:
        if sql("select count(*) from pg_stat_activity where datname = current_database() and wait_event_type = 'Lock';") != '0':
            return
        time.sleep(0.05)
    raise AssertionError('Second writer never waited for the artist lock')


def overlap(artist, first_sql, second_sql, should_fail=False, expected_error='Artist was curated'):
    first = subprocess.Popen(psql, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    second = None
    try:
        first.stdin.write('begin;\n' + first_sql + '\n\\echo LOCKED\n')
        first.stdin.flush()
        while True:
            line = first.stdout.readline()
            if line.strip() == 'LOCKED':
                break
            if not line:
                raise AssertionError(first.stderr.read())
        second = subprocess.Popen(psql, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        second.stdin.write(second_sql + '\n')
        second.stdin.flush()
        wait_for_blocked()
        first.stdin.write('commit;\n')
        first.stdin.flush()
        _, err = first.communicate(timeout=10)
        assert first.returncode == 0, err
        _, err = second.communicate(timeout=10)
        if should_fail:
            assert second.returncode != 0 and expected_error in err, err
        else:
            assert second.returncode == 0, err
    finally:
        for process in (first, second):
            if process and process.poll() is None:
                process.kill()
                process.wait()


subprocess.run(base + ['createdb', '-U', 'postgres', database], check=True)
try:
    sql("""
    do $$ begin
      if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if;
      if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
      if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role bypassrls; end if;
    end $$;
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
    """)
    for migration in sorted((root / 'supabase/migrations').glob('*.sql')):
        sql('begin;\n' + migration.read_text() + '\ncommit;')
    print('PASS: full migration replay', flush=True)
    sql((root / 'supabase/tests/public_builder_video_dedupe.sql').read_text())
    print('PASS: category precedence, manual selections, stale cleanup, invalid payloads, guards and permissions', flush=True)
    sql((root / 'supabase/tests/admin_artist_delete.sql').read_text())
    print('PASS: admin deletion authorization, confirmation, curation guard, cascades and audit', flush=True)
    # Reverse arrival order too: existing persisted category wins in either order.
    for first_type, second_type in [('concert', 'interview'), ('music_video', 'concert')]:
        artist = sql("insert into public.artists(name) values ('%s') returning id;" % uuid.uuid4())
        overlap(artist, rpc(artist, first_type), rpc(artist, second_type))
        assert sql("select count(*) || ':' || min(video_type) from public.artist_videos where artist_id='%s';" % artist) == '1:' + first_type
    print('PASS: genuinely overlapping builds serialize without cross-type duplicates', flush=True)
    artist = sql("insert into public.artists(name) values ('%s') returning id;" % uuid.uuid4())
    sql(rpc(artist, 'concert'))
    overlap(artist, "update public.artists set last_refreshed_at=now() where id='%s';" % artist,
            "select public.upsert_public_build_videos('%s', '[]', 'concert');" % artist, should_fail=True)
    assert sql("select count(*) from public.artist_videos where artist_id='%s';" % artist) == '1'
    print('PASS: concurrent completion/admin publication blocks stale deletion', flush=True)
    actor = sql("insert into auth.users(id) values(gen_random_uuid()) returning id;")
    sql("insert into public.admin_users(user_id) values('%s');" % actor)
    for update, expected_error in [("is_curated=true", 'Curated artists cannot be deleted'), ("name='Renamed fixture'", 'Artist name confirmation does not match')]:
        artist = sql("insert into public.artists(name) values('Delete race fixture') returning id;")
        overlap(artist, "update public.artists set %s where id='%s';" % (update, artist),
                "select public.admin_delete_artist('%s','%s','Delete race fixture');" % (artist, actor),
                should_fail=True, expected_error=expected_error)
        assert sql("select count(*) from public.artists where id='%s';" % artist) == '1'
        assert sql("select count(*) from public.admin_artist_deletions where artist_id='%s';" % artist) == '0'
        sql("delete from public.artists where id='%s';" % artist)
    print('PASS: concurrent curation and rename prevent stale admin deletions', flush=True)

finally:
    subprocess.run(base + ['dropdb', '-U', 'postgres', '--force', database], check=True)
