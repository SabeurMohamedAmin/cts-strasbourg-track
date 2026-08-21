export interface UserLocation {
  latitude: number
  longitude: number
  accuracy: number
}

export function useUserLocation() {
  const location = useState<UserLocation | null>('user-location', () => null)

  function setLocation(latitude: number, longitude: number, accuracy = 0) {
    location.value = { latitude, longitude, accuracy }
  }

  return { location, setLocation }
}
