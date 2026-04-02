import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Patient_Portal() {
  const navigate = useNavigate()

  useEffect(() => {
    try {
      const tok = localStorage.getItem('patient.token')
      if (!tok) {
        navigate('/patient/login')
        return
      }
      navigate('/patient/add-appointment')
    } catch {
      navigate('/patient/login')
    }
  }, [navigate])

  return null
}
