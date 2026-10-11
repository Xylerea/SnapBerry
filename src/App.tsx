

import { useState } from 'react'
import CameraBooth from './Components/CameraBooth'
import FleuraLogo from './Components/FleuraLogo'
import { App as NativeApp } from '@capacitor/app'
import { useAndroidBack } from './hooks/useAndroidBack'

import { Camera, Sparkles } from 'lucide-react'


function App() {
  const [showCamera, setShowCamera] = useState(false)
  useAndroidBack(() => {
    const event = new Event('snapberry:back', { cancelable: true })
    window.dispatchEvent(event)
    if (!event.defaultPrevented && window.confirm('Close SnapBerry?')) void NativeApp.exitApp()
  })

  if (showCamera) {
    return <CameraBooth onClose={() => setShowCamera(false)} />
  }

  return (

    <div className="min-h-screen bg-[#FFF5F8] flex flex-col">
      <header className="flex flex-wrap items-center justify-between gap-2 px-6 py-5 md:px-12">
        <h1 className="text-2xl font-bold text-pink-600">
          SnapBerry 🍓
        </h1>

      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 pb-6 text-center">
        <FleuraLogo className="mb-6 h-64 w-64 max-w-full sm:h-80 sm:w-80 md:h-96 md:w-96" />

        <div className="mb-3 flex items-center gap-2">
          <Sparkles size={20} className="text-pink-400" />
          <span className="text-sm font-medium text-pink-500">
            Your photobooth
          </span>
          <Sparkles size={20} className="text-pink-400" />
        </div>

        <h2 className="mb-4 text-4xl font-bold text-gray-800 md:text-6xl">
          Capture your
          <span className="block text-pink-600">
            sweetest moments.
          </span>
        </h2>

        <button
          type="button"
          onClick={() => setShowCamera(true)}
          className="mt-4 flex items-center gap-3 rounded-full bg-pink-600 px-8 py-4 font-semibold text-white shadow-lg transition hover:bg-pink-700"
        >
          <Camera size={20} />
          Start Photobooth
        </button>


      </main>
    </div>
  )
}

export default App
