import { useRouter } from "expo-router";
import { LanguageSelector } from "@/components/LanguageSelector";

export default function LanguageSelectScreen() {
  const router = useRouter();
  return (
    <LanguageSelector
      onBack={() => router.back()}
      onSelect={() => router.back()}
    />
  );
}
