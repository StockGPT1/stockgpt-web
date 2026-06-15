import { RankingsWhyMetricsPatch } from "@/components/RankingsWhyMetricsPatch";

export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <RankingsWhyMetricsPatch />
    </>
  );
}
