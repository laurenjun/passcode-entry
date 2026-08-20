import { notFound } from "next/navigation";
import PasscodeEntry, {
  type PasscodeStatus,
} from "@/components/PasscodeEntry/PasscodeEntry";
import Artboard from "@/components/Artboard/Artboard";

/** Single 1512 x 982 frame, for 1:1 comparison against a Figma export. */
const STATES: Record<string, { status: PasscodeStatus; value?: string }> = {
  empty: { status: "empty" },
  filling: { status: "filling", value: "122" },
  submitting: { status: "submitting", value: "1234" },
  authenticated: { status: "authenticated" },
};

export function generateStaticParams() {
  return Object.keys(STATES).map((state) => ({ state }));
}

export default async function ArtboardPage({
  params,
}: {
  params: Promise<{ state: string }>;
}) {
  const { state } = await params;
  const preset = STATES[state];
  if (!preset) notFound();

  return (
    <Artboard>
      <PasscodeEntry {...preset} />
    </Artboard>
  );
}
