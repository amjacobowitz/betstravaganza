export interface BirdInfo {
  species: string
  plural: string
  imageUrl: string
}

// Keyed by team_name as stored in DB (plural form)
export const BIRD_BY_TEAM: Record<string, BirdInfo> = {
  'American Robins': {
    species: 'American Robin',
    plural: 'American Robins',
    imageUrl: '/birds/Aaron_American Robin.jpg',
  },
  "Kirtland's Warblers": {
    species: "Kirtland's Warbler",
    plural: "Kirtland's Warblers",
    imageUrl: "/birds/PJ_Kirtland's Warbler.jpeg",
  },
  'Sandhill Cranes': {
    species: 'Sandhill Crane',
    plural: 'Sandhill Cranes',
    imageUrl: '/birds/Marco_Sandhill Crane.jpg',
  },
  'Tufted Titmice': {
    species: 'Tufted Titmouse',
    plural: 'Tufted Titmice',
    imageUrl: '/birds/Jeremy_Tufted Titlmouse.jpg',
  },
  'Northern Cardinals': {
    species: 'Northern Cardinal',
    plural: 'Northern Cardinals',
    imageUrl: '/birds/Nick_Northern Cardinal.jpg',
  },
  'Red-tailed Hawks': {
    species: 'Red-tailed Hawk',
    plural: 'Red-tailed Hawks',
    imageUrl: '/birds/Davd_Red-tailed Hawk.jpg',
  },
  'Baltimore Orioles': {
    species: 'Baltimore Oriole',
    plural: 'Baltimore Orioles',
    imageUrl: '/birds/Billy_Baltimore Oriole.jpg',
  },
  'Rock Pigeons': {
    species: 'Rock Pigeon',
    plural: 'Rock Pigeons',
    imageUrl: '/birds/Jeff_Rock Pigeon.jpg',
  },
  'Bald Eagles': {
    species: 'Bald Eagle',
    plural: 'Bald Eagles',
    imageUrl: '/birds/Chris_Bald Eagle.jpg',
  },
  'Wood Ducks': {
    species: 'Wood Duck',
    plural: 'Wood Ducks',
    imageUrl: '/birds/Reid_Wood Duck.jpg',
  },
  'Eastern Bluebirds': {
    species: 'Eastern Bluebird',
    plural: 'Eastern Bluebirds',
    imageUrl: '/birds/Shad_Eastern Bluebird.jpg',
  },
}

export function getBird(teamName: string | null | undefined): BirdInfo | null {
  if (!teamName) return null
  return BIRD_BY_TEAM[teamName] ?? null
}
