import LandingTrustBar from './LandingTrustBar'
import LandingFeatures from './LandingFeatures'
import LandingGallery from './LandingGallery'
import LandingPricing from './LandingPricing'
import LandingFooter from './LandingFooter'

/** Sezioni sotto la piega — chunk unico per evitare layout shift a catena. */
export default function LandingBelowFold() {
  return (
    <>
      <LandingTrustBar />
      <LandingFeatures />
      <LandingGallery />
      <LandingPricing />
      <LandingFooter />
    </>
  )
}
