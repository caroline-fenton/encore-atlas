export type SceneDefinition = {
  id: string
  name: string
  place: string
  era: string
  accent: string
  introduction: string
  significance: string
  traits: string[]
  artistNames: string[]
}

export const scenes: SceneDefinition[] = [
  {
    id: "dc-revolution-summer",
    name: "D.C. Revolution Summer",
    place: "Washington, D.C.",
    era: "1985 and its aftermath",
    accent: "#d94f43",
    introduction:
      "A turn inward inside an already formidable hardcore city: urgency stayed, but melody, vulnerability, and new ideas about community moved to the front.",
    significance:
      "Revolution Summer helped open the route from hardcore into post-hardcore and emo without sanding away punk's intensity.",
    traits: ["Dischord orbit", "Emotional hardcore", "DIY ethics", "Post-hardcore"],
    artistNames: ["rites of spring", "gray matter", "dag nasty", "jawbox"],
  },
  {
    id: "bay-area-ska-punk",
    name: "Bay Area Ska-Punk",
    place: "East Bay and Northern California",
    era: "Late 1980s to mid-1990s",
    accent: "#3580b0",
    introduction:
      "Fast punk, Jamaican rhythm, all-ages rooms, and a deliberately scrappy sense of possibility converged around the East Bay.",
    significance:
      "The scene connected underground punk infrastructure to the 1990s ska revival and helped define a generation of melodic DIY touring bands.",
    traits: ["924 Gilman orbit", "Ska-punk", "All-ages DIY", "Breakneck live sets"],
    artistNames: ["operation ivy", "rancid", "link 80", "skankin' pickle"],
  },
  {
    id: "manchester-after-dark",
    name: "Manchester After Dark",
    place: "Manchester, England",
    era: "1980s to mid-1990s",
    accent: "#9256a8",
    introduction:
      "Manchester repeatedly turned local weather, clubs, football-scale confidence, and independent-label ambition into music the rest of Britain had to answer.",
    significance:
      "From literate indie to Madchester psychedelia and Britpop swagger, the city's scenes kept rewriting the scale of guitar music.",
    traits: ["Madchester", "Indie lineage", "Creation and Factory orbit", "Mass singalongs"],
    artistNames: ["the smiths", "the stone roses", "oasis"],
  },
  {
    id: "brooklyn-diy-2000s",
    name: "Brooklyn DIY",
    place: "Brooklyn, New York",
    era: "Mid-to-late 2000s",
    accent: "#5a9a6e",
    introduction:
      "Warehouse rooms, blogs, tiny labels, and a flood of new arrivals turned Brooklyn into an unruly laboratory for indie music.",
    significance:
      "The scene collapsed the distance between experimental impulses and immediate pop pleasure while changing how new bands reached listeners.",
    traits: ["Lo-fi revival", "Warehouse shows", "Dance-punk", "Blog-era indie"],
    artistNames: ["vivian girls", "matt and kim", "yeasayer", "sonic youth"],
  },
  {
    id: "chicago-punk-emo",
    name: "Chicago Punk's Melodic Turn",
    place: "Chicago, Illinois",
    era: "Late 1990s to mid-2000s",
    accent: "#eba264",
    introduction:
      "Chicago punk's blunt humor and working-band toughness met increasingly personal songwriting, creating a durable bridge between punk, emo, and pop.",
    significance:
      "The city's bands helped make emotionally direct punk songwriting feel native to both basement rooms and enormous stages.",
    traits: ["Melodic punk", "Emo crossover", "Midwestern candor", "Relentless touring"],
    artistNames: ["lawrence arms", "fall out boy"],
  },
  {
    id: "new-jersey-punk-post-hardcore",
    name: "New Jersey Punk and Post-Hardcore",
    place: "New Brunswick and the wider New Jersey circuit",
    era: "1990s to early 2000s",
    accent: "#b0456a",
    introduction:
      "A dense web of basements, college towns, shore venues, and nearby-city connections produced bands that pushed punk toward melody and post-hardcore drama.",
    significance:
      "New Jersey became a crucial connective tissue between hardcore, melodic punk, emo, and the 2000s post-hardcore wave.",
    traits: ["Basement shows", "Melodic hardcore", "Post-hardcore", "College-town DIY"],
    artistNames: ["lifetime", "bigwig", "thursday"],
  },
]

