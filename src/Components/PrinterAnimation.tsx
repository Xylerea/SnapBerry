export default function PrinterAnimation({ image }: { image: string }) {
    return <figure className="printer-animation" aria-label="Animation preview of your photo strip coming out of a printer">
        <div className="printer-animation-machine" aria-hidden="true"><span /></div>
        <div className="printer-animation-output"><img src={image} alt="Your photo strip in the printer animation" /></div>
    </figure>
}
