import { notFound } from "next/navigation";
import ComingSoon from "@/components/train/ComingSoon";
import TrainDashboard from "@/components/train/TrainDashboard";
import {
  getAnalytics,
  getInsights,
  getLiveSchedule,
  getLiveStatus,
  getPredictions,
  getReliability,
  getRuns,
  getTrain,
  getTrainSummary,
} from "@/lib/api";

export default async function TrainPage({ params }: { params: Promise<{ trainNumber: string }> }) {
  const { trainNumber } = await params;
  const train = await getTrain(trainNumber);

  if (!train) {
    const summary = await getTrainSummary(trainNumber);
    if (!summary) notFound();
    return <ComingSoon summary={summary} />;
  }

  const [liveStatus, liveSchedule, insights, predictions, runs, analytics, reliability] = await Promise.all([
    getLiveStatus(trainNumber),
    getLiveSchedule(trainNumber),
    getInsights(trainNumber),
    getPredictions(trainNumber),
    getRuns(trainNumber),
    getAnalytics(trainNumber),
    getReliability(trainNumber),
  ]);

  return (
    <TrainDashboard
      train={train}
      liveStatus={liveStatus!}
      liveSchedule={liveSchedule}
      insights={insights}
      predictions={predictions!}
      runs={runs}
      analytics={analytics!}
      reliability={reliability!}
    />
  );
}
