import { useRef, useState } from 'react'
import { api } from '../api'

export default function PhotoUpload({ value, onChange }) {
  const ref = useRef()
  const [uploading, setUploading] = useState(false)

  const handleFile = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    try {
      const res = await api.uploadPhoto(file)
      onChange(res.url)
    } catch {
      alert('Ошибка загрузки фото')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      {value && (
        <img src={value} className="w-full h-36 object-cover rounded-xl mb-2" />
      )}
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      <button type="button" onClick={() => ref.current.click()}
        className="w-full border-2 border-dashed border-[#FFBE00] rounded-xl py-3 text-sm text-gray-400 font-semibold active:bg-yellow-50 transition-colors">
        {uploading ? '⏳ Загрузка...' : value ? '🔄 Заменить фото' : '📷 Загрузить фото'}
      </button>
    </div>
  )
}
