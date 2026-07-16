import type { Metadata } from "next";
import AboutClient from "./AboutClient";

export const metadata: Metadata = {
  title: "關於筆記 | JapanNote",
  description: "JapanNote 是給日文初學者的自學筆記，整理單字、例句、文法與日常練習。"
};

export default function AboutPage() {
  return <AboutClient />;
}
