import { forwardRef, lazy, Suspense, type ComponentProps } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const QRCodeCanvas = lazy(() =>
  import('qrcode.react').then(mod => ({ default: mod.QRCodeCanvas })),
)

type QrCanvasProps = ComponentProps<typeof QRCodeCanvas>

interface AuraQrCanvasProps extends QrCanvasProps {
  fallbackClassName?: string
}

const AuraQrCanvas = forwardRef<HTMLCanvasElement, AuraQrCanvasProps>(function AuraQrCanvas(
  { size = 128, fallbackClassName, className, ...props },
  ref,
) {
  const dim = typeof size === 'number' ? size : 128

  return (
    <Suspense
      fallback={(
        <div
          className={cn('flex items-center justify-center rounded-lg bg-white', fallbackClassName)}
          style={{ width: dim, height: dim }}
          aria-hidden
        >
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      )}
    >
      <QRCodeCanvas ref={ref} size={size} className={className} {...props} />
    </Suspense>
  )
})

export default AuraQrCanvas
