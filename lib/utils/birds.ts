export interface BirdInfo {
  species: string
  plural: string
  imageUrl: string
  color: string
}

// Keyed by team_name as stored in DB (plural form)
export const BIRD_BY_TEAM: Record<string, BirdInfo> = {
  'American Robins': {
    species: 'American Robin',
    plural: 'American Robins',
    imageUrl: '/birds/Aaron_American Robin.jpg',
    color: '#e06030', // orange-red breast
  },
  "Kirtland's Warblers": {
    species: "Kirtland's Warbler",
    plural: "Kirtland's Warblers",
    imageUrl: "/birds/PJ_Kirtland's Warbler.jpeg",
    color: '#c8c420', // yellow-olive underparts
  },
  'Sandhill Cranes': {
    species: 'Sandhill Crane',
    plural: 'Sandhill Cranes',
    imageUrl: '/birds/Marco_Sandhill Crane.jpg',
    color: '#a0b8c8', // blue-gray plumage
  },
  'Tufted Titmice': {
    species: 'Tufted Titmouse',
    plural: 'Tufted Titmice',
    imageUrl: '/birds/Jeremy_Tufted Titlmouse.jpg',
    color: '#38b0a0', // teal (peachy flanks + gray = muted teal)
  },
  'Northern Cardinals': {
    species: 'Northern Cardinal',
    plural: 'Northern Cardinals',
    imageUrl: '/birds/Nick_Northern Cardinal.jpg',
    color: '#e82828', // vivid red
  },
  'Red-tailed Hawks': {
    species: 'Red-tailed Hawk',
    plural: 'Red-tailed Hawks',
    imageUrl: '/birds/Davd_Red-tailed Hawk.jpg',
    color: '#9a5030', // rusty brown tail
  },
  'Baltimore Orioles': {
    species: 'Baltimore Oriole',
    plural: 'Baltimore Orioles',
    imageUrl: '/birds/Billy_Baltimore Oriole.jpg',
    color: '#f09820', // vivid orange plumage
  },
  'Rock Pigeons': {
    species: 'Rock Pigeon',
    plural: 'Rock Pigeons',
    imageUrl: '/birds/Jeff_Rock Pigeon.jpg',
    color: '#9060c0', // iridescent purple neck
  },
  'Bald Eagles': {
    species: 'Bald Eagle',
    plural: 'Bald Eagles',
    imageUrl: '/birds/Chris_Bald Eagle.jpg',
    color: '#2858b0', // dark navy (patriotic blue)
  },
  'Wood Ducks': {
    species: 'Wood Duck',
    plural: 'Wood Ducks',
    imageUrl: '/birds/Reid_Wood Duck.jpg',
    color: '#20a060', // iridescent green head
  },
  'Eastern Bluebirds': {
    species: 'Eastern Bluebird',
    plural: 'Eastern Bluebirds',
    imageUrl: '/birds/Shad_Eastern Bluebird.jpg',
    color: '#2090e0', // vivid sky blue
  },
}

export function getBird(teamName: string | null | undefined): BirdInfo | null {
  if (!teamName) return null
  return BIRD_BY_TEAM[teamName] ?? null
}
