import logo from '../assets/fleura-logo-transparent.png'

export default function FleuraLogo({ className = '' }: { className?: string }) {
    return <img src={logo} alt="FLEURA — Gifts, Prints, Souvenirs"
        width={1262} height={1246}
        className={`shrink-0 object-contain ${className}`} />
}
