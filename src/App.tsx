

import { useState } from 'react'
import CameraBooth from './Components/CameraBooth'
import FleuraLogo from './Components/FleuraLogo'
import LayoutDetails from './Components/LayoutDetails'
import CustomizedLayouts from './Components/CustomizedLayouts'
import type { StripOptions } from './lib/photoStrip'
import { App as NativeApp } from '@capacitor/app'
import { useAndroidBack } from './hooks/useAndroidBack'
import { isAndroidApp } from './lib/native'
import './App.css'

import { ArrowLeft, Camera, Sparkles } from 'lucide-react'

function SamplePhotos({ count }: { count: number }) {
  return <div className="hero-sample-grid">{Array.from({ length: count }, (_, index) =>
    <div key={index} className={`hero-sample-photo hero-sample-photo-${index % 4}`}>
      <span className="hero-sample-person" /><span className="hero-sample-person hero-sample-friend" />
    </div>,
  )}</div>
}

function App() {
  const [showCamera, setShowCamera] = useState(false)
  const [showLayoutChoice, setShowLayoutChoice] = useState(false)
  const [selectedLayout, setSelectedLayout] = useState<StripOptions['layout']>('classic')
  const [showLayoutDetails, setShowLayoutDetails] = useState(false)
  const [showCustomDesigns, setShowCustomDesigns] = useState(false)
  const [selectedDesignId, setSelectedDesignId] = useState<string | null>(null)
  const [layoutOptions, setLayoutOptions] = useState<StripOptions>({ monochrome: false, frameColor: 'White', caption: '', date: '', layout: 'classic' })
  const website = !isAndroidApp()
  useAndroidBack(() => {
    const event = new Event('snapberry:back', { cancelable: true })
    window.dispatchEvent(event)
    if (!event.defaultPrevented && window.confirm('Close SnapBerry?')) void NativeApp.exitApp()
  })

  if (showCamera) {
    return <CameraBooth initialLayout={website ? selectedLayout : undefined} initialOptions={website ? layoutOptions : undefined} onClose={() => setShowCamera(false)}
      onExitToLayouts={() => { setShowCamera(false); setShowLayoutDetails(false); setShowCustomDesigns(false); setShowLayoutChoice(true) }} />
  }

  return (

    <div className={`min-h-screen bg-[#FFF5F8] flex flex-col ${website ? 'homepage-web' : ''}`}>
      <header className="flex flex-wrap items-center justify-between gap-2 px-6 py-5 md:px-12">
        <h1 className="text-2xl font-bold text-pink-600">
          SnapBerry 🍓
        </h1>

      </header>

      {website && showCustomDesigns ? <CustomizedLayouts selectedId={selectedDesignId} selectedLayout={selectedLayout}
        onBack={() => { setShowCustomDesigns(false); setShowLayoutChoice(true) }}
        onCustomize={() => {
          setLayoutOptions({ monochrome: false, frameColor: 'White', caption: '', date: '', layout: selectedLayout ?? 'classic' })
          setShowCustomDesigns(false); setShowLayoutDetails(true)
        }}
        onSelect={template => {
          setSelectedDesignId(template.id)
          setSelectedLayout(template.settings.layout ?? 'classic')
          setLayoutOptions({ monochrome: false, caption: '', date: '', ...template.settings })
          setShowCustomDesigns(false); setShowLayoutDetails(false); setShowLayoutChoice(false); setShowCamera(true)
        }} />
      : website && showLayoutDetails ? <LayoutDetails options={layoutOptions} onChange={setLayoutOptions}
        onSaved={id => { setSelectedDesignId(id); setShowLayoutDetails(false); setShowCustomDesigns(true) }}
        onBack={() => { setShowLayoutDetails(false); setShowCustomDesigns(true) }}
        onContinue={() => { setShowLayoutDetails(false); setShowLayoutChoice(false); setShowCamera(true) }} />
      : website && showLayoutChoice ? <main className="homepage-layout-choice" aria-labelledby="layout-choice-title">
        <h2 id="layout-choice-title" className="text-center text-3xl font-bold text-pink-600">Choose Your Photo Layout</h2>
        <div className="layout-choice-grid">
          {([
            { layout: 'classic', label: 'Photo Strip', captures: 4 },
            { layout: 'postcard', label: 'Postcard', captures: 4 },
            { layout: 'landscape', label: 'Landscape Postcard', captures: 3 },
          ] as const).map(({ layout, label, captures }) => <button key={layout} type="button" className="layout-choice-card group"
            onClick={() => {
              setSelectedLayout(layout)
              setLayoutOptions(current => current.layout === layout ? current : { monochrome: false, frameColor: 'White', caption: '', date: '', layout })
              setShowLayoutChoice(false); setShowLayoutDetails(false); setShowCustomDesigns(true)
            }}>
            <div className="layout-choice-preview" aria-hidden="true">
              <div className={`hero-sample-card hero-sample-${layout === 'landscape' ? 'three' : layout}`}>
                {layout === 'classic'
                  ? <div className="hero-sample-strips"><SamplePhotos count={4} /><SamplePhotos count={4} /></div>
                  : <SamplePhotos count={captures} />}
              </div>
            </div>
            <span className="block font-bold text-pink-700">{label}</span>
            <span className="mt-1 block text-sm text-gray-500">{captures} captures</span>
            <span className="layout-choice-action rounded-full bg-pink-600 font-semibold text-white shadow-lg transition group-hover:bg-pink-700">Choose Layout</span>
          </button>)}
        </div>
        <button type="button" onClick={() => setShowLayoutChoice(false)} className="layout-choice-back">
          <ArrowLeft size={18} /> Back
        </button>
      </main> : <main className={website ? 'homepage-hero' : 'flex flex-1 flex-col items-center justify-center px-6 pb-6 text-center'}>
        <div className="hero-brand flex flex-col items-center text-center">
        <FleuraLogo className={website ? 'hero-logo' : 'mb-6 h-64 w-64 max-w-full sm:h-80 sm:w-80 md:h-96 md:w-96'} />

        <div className="mb-3 flex items-center gap-2">
          <Sparkles size={20} className="text-pink-400" />
          <span className="text-sm font-medium text-pink-500">
            Your photobooth
          </span>
          <Sparkles size={20} className="text-pink-400" />
        </div>

        <h2 className={website ? 'hero-heading font-bold text-gray-800' : 'mb-4 text-4xl font-bold text-gray-800 md:text-6xl'}>
          Capture your
          <span className="block text-pink-600">
            sweetest moments.
          </span>
        </h2>
        </div>

        <div className="hero-showcase flex flex-col items-center">
        {website && <div className="hero-samples" role="img" aria-label="Sample photobooth templates: classic double strip, four-photo postcard, and three-photo postcard">
          <div className="hero-sample-card hero-sample-classic">
            <div className="hero-sample-strips"><SamplePhotos count={4} /><SamplePhotos count={4} /></div>
            <div className="hero-sample-label">sweet little moments</div>
          </div>
          <div className="hero-sample-card hero-sample-postcard">
            <SamplePhotos count={4} />
            <div className="hero-sample-label">a day to remember ♡</div>
          </div>
          <div className="hero-sample-card hero-sample-three">
            <SamplePhotos count={3} />
            <div className="hero-sample-label">made with love</div>
          </div>
        </div>}
        <button
          type="button"
          onClick={() => website ? setShowLayoutChoice(true) : setShowCamera(true)}
          className={`mt-4 flex items-center gap-3 rounded-full bg-pink-600 px-8 py-4 font-semibold text-white shadow-lg transition hover:bg-pink-700 ${website ? 'hero-start' : ''}`}
        >
          <Camera size={20} />
          {website ? 'Ready? Smile!' : 'Start Photobooth'}
        </button>
        </div>


      </main>}
    </div>
  )
}

export default App
