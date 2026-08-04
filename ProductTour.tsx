import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { AnimatePresence } from "motion/react";
import SpotlightTour from "./SpotlightTour.tsx";
import OnboardingChecklist from "./OnboardingChecklist.tsx";
import { TOUR_STEPS, CHECKLIST_ITEMS } from "./tour-data.ts";

/**
 * Orchestrates the entire product tour experience:
 * 1. Auto-initializes tour for first-time users
 * 2. Shows spotlight tour (step-by-step highlight)
 * 3. Shows onboarding checklist after tour completion
 */
export default function ProductTour() {
  const progress = useQuery(api.tourProgress.getMyProgress, {});
  const initialize = useMutation(api.tourProgress.initialize);
  const setStep = useMutation(api.tourProgress.setStep);
  const completeTour = useMutation(api.tourProgress.completeTour);
  const toggleItem = useMutation(api.tourProgress.toggleChecklistItem);
  const dismissChecklist = useMutation(api.tourProgress.dismissChecklist);
  const resetTour = useMutation(api.tourProgress.resetTour);

  // Local tour state so UI is snappy without waiting for DB round-trips
  const [localStep, setLocalStep] = useState<number | null>(null);
  const [showTour, setShowTour] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Auto-initialize for new users (no progress row yet)
  useEffect(() => {
    if (progress === null && !initialized) {
      setInitialized(true);
      void initialize({
        totalSteps: TOUR_STEPS.length,
        totalItems: CHECKLIST_ITEMS.length,
      }).then(() => {
        // After init, start the tour
        setLocalStep(0);
        setShowTour(true);
      });
    }
  }, [progress, initialized, initialize]);

  // Sync local step from DB when available
  useEffect(() => {
    if (progress && localStep === null && !progress.tourCompleted) {
      setLocalStep(progress.currentStep);
      setShowTour(true);
    }
  }, [progress, localStep]);

  const handleNext = useCallback(() => {
    if (localStep === null) return;
    const next = localStep + 1;
    setLocalStep(next);
    void setStep({ step: next });
  }, [localStep, setStep]);

  const handlePrev = useCallback(() => {
    if (localStep === null || localStep <= 0) return;
    const prev = localStep - 1;
    setLocalStep(prev);
    void setStep({ step: prev });
  }, [localStep, setStep]);

  const handleSkip = useCallback(() => {
    setShowTour(false);
    setLocalStep(null);
    void completeTour({});
  }, [completeTour]);

  const handleFinish = useCallback(() => {
    setShowTour(false);
    setLocalStep(null);
    void completeTour({});
  }, [completeTour]);

  const handleToggleItem = useCallback(
    (itemId: string) => {
      void toggleItem({ itemId });
    },
    [toggleItem]
  );

  const handleDismiss = useCallback(() => {
    void dismissChecklist({});
  }, [dismissChecklist]);

  const handleRestartTour = useCallback(() => {
    void resetTour({}).then(() => {
      setLocalStep(0);
      setShowTour(true);
    });
  }, [resetTour]);

  // Don't render anything while loading
  if (progress === undefined) return null;

  const tourActive =
    showTour &&
    localStep !== null &&
    localStep < TOUR_STEPS.length;

  const showChecklist =
    progress !== null &&
    progress.tourCompleted &&
    !progress.checklistDismissed;

  return (
    <>
      {/* Spotlight tour overlay */}
      {tourActive && (
        <SpotlightTour
          steps={TOUR_STEPS}
          currentStep={localStep}
          onNext={handleNext}
          onPrev={handlePrev}
          onSkip={handleSkip}
          onFinish={handleFinish}
        />
      )}

      {/* Onboarding checklist (fixed bottom-right) */}
      <AnimatePresence>
        {showChecklist && !tourActive && (
          <div className="fixed bottom-4 right-4 z-50 w-[340px] max-w-[calc(100vw-2rem)]">
            <OnboardingChecklist
              items={CHECKLIST_ITEMS}
              completedIds={progress.completedItems}
              onToggle={handleToggleItem}
              onDismiss={handleDismiss}
              onRestartTour={handleRestartTour}
            />
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
