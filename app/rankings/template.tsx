import { RankingsWhyMetricsPatch } from "@/components/RankingsWhyMetricsPatch";

export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <RankingsWhyMetricsPatch />
      <style>{`
        main [class*="bg-[#faf6f0]"] {
          outline: 1px solid rgba(7, 33, 22, 0.16);
          outline-offset: -1px;
        }
      `}</style>
    </>
  );
}
