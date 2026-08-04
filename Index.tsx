import { useState } from "react";
import { Authenticated, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import OnboardingDialog from "@/components/onboarding-dialog.tsx";
import LandingNav from "./landing/_components/LandingNav.tsx";
import HeroSection from "./landing/_components/HeroSection.tsx";
import StatsBar from "./landing/_components/StatsBar.tsx";
import TrustedBySection from "./landing/_components/TrustedBySection.tsx";
import FeaturesSection from "./landing/_components/FeaturesSection.tsx";
import BenefitsSection from "./landing/_components/BenefitsSection.tsx";
import ModulesSection from "./landing/_components/ModulesSection.tsx";
import WorkflowSection from "./landing/_components/WorkflowSection.tsx";
import SecuritySection from "./landing/_components/SecuritySection.tsx";
import TestimonialSection from "./landing/_components/TestimonialSection.tsx";
import CTASection from "./landing/_components/CTASection.tsx";
import LandingFooter from "./landing/_components/LandingFooter.tsx";
import LandingPageEditor from "./landing/_components/LandingPageEditor.tsx";
import PricingSection from "./landing/_components/PricingSection.tsx";
import ProductDemoSection from "./landing/_components/ProductDemoSection.tsx";
import CallsSection from "./landing/_components/CallsSection.tsx";

export default function Index() {
  const visibility = useQuery(
    api.siteSettings.getLandingSectionVisibility,
    {},
  );

  return (
    <>
      <Authenticated>
        <RoleRequestGate />
        <SuperAdminEditorFab />
      </Authenticated>
      <div className="min-h-screen bg-background">
        <LandingNav />
        {(!visibility || visibility.hero) && <HeroSection />}
        {(!visibility || visibility.stats) && <StatsBar />}
        {(!visibility || visibility.trustedBy) && <TrustedBySection />}
        {(!visibility || visibility.features) && <FeaturesSection />}
        {(!visibility || visibility.demo) && <ProductDemoSection />}
        {(!visibility || visibility.benefits) && <BenefitsSection />}
        {(!visibility || visibility.modules) && <ModulesSection />}
        {(!visibility || visibility.workflow) && <WorkflowSection />}
        {(!visibility || visibility.calls) && <CallsSection />}
        {(!visibility || visibility.security) && <SecuritySection />}
        {(!visibility || visibility.testimonial) && <TestimonialSection />}
        {(!visibility || visibility.pricing) && <PricingSection />}
        {(!visibility || visibility.cta) && <CTASection />}
        {(!visibility || visibility.footer) && <LandingFooter />}
      </div>
    </>
  );
}

/** Floating editor button – only visible to super admins */
function SuperAdminEditorFab() {
  const currentUser = useQuery(api.users.getCurrentUser, {});

  if (!currentUser || currentUser.role !== "super_admin") return null;

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <LandingPageEditor />
    </div>
  );
}

/** Checks if authenticated user has not completed onboarding and shows the new onboarding flow */
function RoleRequestGate() {
  const currentUser = useQuery(api.users.getCurrentUser, {});
  const pendingRequest = useQuery(api.roleRequests.getMyPendingRequest, {});
  const [dismissed, setDismissed] = useState(false);

  // Brand-new user: no role, no account status, no pending request yet
  const isNewUser =
    currentUser !== undefined &&
    !currentUser?.role &&
    !currentUser?.accountStatus &&
    pendingRequest !== undefined &&
    pendingRequest === null;

  return (
    <OnboardingDialog
      open={Boolean(isNewUser) && !dismissed}
      onClose={() => setDismissed(true)}
    />
  );
}
