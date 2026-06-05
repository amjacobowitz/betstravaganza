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
  'Great Horned Owls': {
    species: 'Great Horned Owl',
    plural: 'Great Horned Owls',
    imageUrl: '/birds/PJ_Great Horned Owl.jpg',
    color: '#8b6914', // warm brown barring
  },
  'American Crows': {
    species: 'American Crow',
    plural: 'American Crows',
    imageUrl: '/birds/Marco_American Crow.jpg',
    color: '#2a2a2a', // glossy black
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
  'Blue Jays': {
    species: 'Blue Jay',
    plural: 'Blue Jays',
    imageUrl: '/birds/Shad_Blue Jay.jpg',
    color: '#2090e0', // vivid blue
  },
}

export function getBird(teamName: string | null | undefined): BirdInfo | null {
  if (!teamName) return null
  return BIRD_BY_TEAM[teamName] ?? null
}
