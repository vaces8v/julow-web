import { MeetingRoomPage } from "@/components/pages/meeting-room-page";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MeetingRoomPage meetingId={id} />;
}
