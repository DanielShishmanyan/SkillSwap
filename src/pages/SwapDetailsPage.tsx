import {
  ArrowLeft,
  ArrowRightLeft,
  CalendarDays,
  Check,
  Circle,
  Link as LinkIcon,
  MapPin,
  MessageCircle,
  X,
} from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { useAppStore } from "../app/app-store.context";
import { SwapModal } from "../components/transactions/SwapModal";
import { Avatar } from "../components/ui/Avatar";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import {
  calculateSwapBalance,
  swapProgress,
} from "../features/swaps/swaps.utils";
import type { SwapSession } from "../types/domain";

export function SwapDetailsPage() {
  const { swapId } = useParams();
  const nav = useNavigate();
  const {
    swaps,
    users,
    currentUser,
    acceptSwap,
    updateSwap,
    scheduleSession,
    completeSession,
  } = useAppStore();
  const swap = swaps.find((item) => item.id === swapId);
  const [counterOpen, setCounterOpen] = useState(false);
  const [sessionToSchedule, setSessionToSchedule] = useState<SwapSession>();
  if (!swap)
    return (
      <main className="page-shell py-12">
        <h1 className="text-2xl font-bold">Swap not found</h1>
        <Button className="mt-5" onClick={() => nav("/swaps")}>
          Back to swaps
        </Button>
      </main>
    );
  const partner = users.find(
    (user) =>
      user.id ===
      (swap.requesterId === currentUser.id
        ? swap.receiverId
        : swap.requesterId),
  );
  const canRespond =
    swap.status === "pending" && swap.lastProposedBy !== currentUser.id;
  const balance = calculateSwapBalance(swap.requesterOffer, swap.receiverOffer);
  const progress = swapProgress(swap);
  const ownSessions = swap.sessions.filter(
    (session) => session.teacherId === currentUser.id,
  );
  const learningSessions = swap.sessions.filter(
    (session) => session.learnerId === currentUser.id,
  );
  const ownOffer =
    swap.requesterId === currentUser.id
      ? swap.requesterOffer
      : swap.receiverOffer;
  const learningOffer =
    swap.requesterId === currentUser.id
      ? swap.receiverOffer
      : swap.requesterOffer;
  return (
    <main className="page-shell page-enter py-7 sm:py-10">
      <Link
        to="/swaps"
        className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-muted hover:text-ink"
      >
        <ArrowLeft size={16} />
        Back to swaps
      </Link>
      <section className="surface p-5 sm:p-7">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-start">
          <div className="flex items-start gap-4">
            {partner && (
              <Avatar src={partner.avatar} name={partner.name} size="lg" />
            )}
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold sm:text-3xl">
                  {partner?.name}
                </h1>
                <Badge
                  tone={
                    swap.status === "active"
                      ? "green"
                      : swap.status === "pending"
                        ? "amber"
                        : swap.status === "completed"
                          ? "blue"
                          : "neutral"
                  }
                >
                  {swap.status} swap
                </Badge>
              </div>
              <div className="mt-3 flex items-center gap-3 text-xl font-extrabold">
                <span>{swap.requesterOffer.skillName}</span>
                <span className="text-brand-600">↔</span>
                <span>{swap.receiverOffer.skillName}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted">
                <span>
                  Created{" "}
                  {new Date(swap.createdAt).toLocaleDateString([], {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
                <span className="capitalize">
                  {swap.deliveryMode.replace("_", " ")}
                </span>
                <strong className="text-brand-700">Free exchange · €0</strong>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {canRespond && (
              <>
                <Button
                  onClick={() => {
                    acceptSwap(swap.id);
                    toast.success("Swap accepted. Session slots are ready.");
                  }}
                >
                  <Check size={17} />
                  Accept swap
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setCounterOpen(true)}
                >
                  Counter offer
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    updateSwap(swap.id, "declined");
                    toast.info("Proposal declined");
                  }}
                >
                  <X size={17} />
                  Decline
                </Button>
              </>
            )}
            <Link
              to="/messages"
              className="inline-flex min-h-10 items-center gap-2 rounded-md border border-line px-4 text-sm font-bold hover:bg-slate-50"
            >
              <MessageCircle size={16} />
              Open chat
            </Link>
          </div>
        </div>
        {swap.status === "pending" && (
          <div
            className={`mt-6 rounded-md border p-4 ${swap.lastProposedBy === currentUser.id ? "border-line bg-canvas" : "border-brand-200 bg-brand-50"}`}
          >
            <p className="font-bold">
              {swap.lastProposedBy === currentUser.id
                ? "Waiting for their response"
                : swap.proposalVersion > 1
                  ? `${partner?.name} sent you a counter offer.`
                  : `${partner?.name} wants to swap skills with you.`}
            </p>
            {swap.requesterMessage && (
              <p className="mt-2 text-sm italic text-muted">
                “{swap.requesterMessage}”
              </p>
            )}
          </div>
        )}
      </section>
      <section className="mt-6 surface p-5 sm:p-7">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="eyebrow">Swap balance</p>
            <h2 className="mt-1 text-xl font-bold">
              {balance.balanced ? "Balanced commitment" : "Uneven commitment"}
            </h2>
          </div>
          <Badge tone={balance.balanced ? "green" : "amber"}>
            {balance.difference} min difference
          </Badge>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-[1fr_auto_1fr]">
          <OfferSummary
            title={
              swap.requesterId === currentUser.id ? "You teach" : "They teach"
            }
            name={swap.requesterOffer.skillName}
            sessions={swap.requesterOffer.sessionsCount}
            duration={swap.requesterOffer.minutesPerSession}
          />
          <span className="mx-auto grid size-10 place-items-center self-center rounded-full bg-brand-100 text-brand-700">
            <ArrowRightLeft size={19} />
          </span>
          <OfferSummary
            title={
              swap.receiverId === currentUser.id ? "You teach" : "They teach"
            }
            name={swap.receiverOffer.skillName}
            sessions={swap.receiverOffer.sessionsCount}
            duration={swap.receiverOffer.minutesPerSession}
          />
        </div>
        {swap.preferredStartDate && (
          <p className="mt-4 flex items-center gap-2 text-sm text-muted">
            <CalendarDays size={16} />
            Preferred period:{" "}
            {new Date(
              `${swap.preferredStartDate}T12:00`,
            ).toLocaleDateString()}{" "}
            {swap.preferredEndDate &&
              `– ${new Date(`${swap.preferredEndDate}T12:00`).toLocaleDateString()}`}
          </p>
        )}
      </section>
      {swap.status !== "pending" && swap.status !== "declined" && (
        <>
          <section className="mt-6">
            <div className="mb-5 flex items-end justify-between">
              <div>
                <p className="eyebrow">Session commitments</p>
                <h2 className="mt-1 text-2xl font-bold">
                  {progress.completed} of {progress.total} completed
                </h2>
              </div>
              <span className="text-sm font-bold text-brand-700">
                {progress.total
                  ? Math.round((progress.completed / progress.total) * 100)
                  : 0}
                %
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full bg-brand-600"
                style={{
                  width: `${progress.total ? (progress.completed / progress.total) * 100 : 0}%`,
                }}
              />
            </div>
            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <SessionColumn
                title={`You teach ${partner?.name?.split(" ")[0]}`}
                skill={ownOffer.skillName}
                sessions={ownSessions}
                onSchedule={setSessionToSchedule}
                onComplete={(session) => {
                  completeSession(swap.id, session.id);
                  toast.success("Session marked complete");
                }}
                currentUserId={currentUser.id}
              />
              <SessionColumn
                title={`${partner?.name?.split(" ")[0]} teaches you`}
                skill={learningOffer.skillName}
                sessions={learningSessions}
                onSchedule={setSessionToSchedule}
                onComplete={(session) => {
                  completeSession(swap.id, session.id);
                  toast.success("Session confirmed complete");
                }}
                currentUserId={currentUser.id}
              />
            </div>
          </section>
          <section className="mt-6 surface p-5 sm:p-7">
            <h2 className="text-xl font-bold">Activity</h2>
            <div className="mt-5 space-y-0">
              {[...swap.activity].reverse().map((activity, index) => (
                <div key={activity.id} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <span className="mt-1 size-2.5 rounded-full bg-brand-600" />
                    {index < swap.activity.length - 1 && (
                      <span className="h-full w-px bg-line" />
                    )}
                  </div>
                  <div className="pb-6">
                    <p className="text-sm font-semibold">{activity.message}</p>
                    <p className="mt-1 text-xs text-muted">
                      {new Date(activity.createdAt).toLocaleString([], {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
      <SwapModal
        user={partner}
        swap={swap}
        open={counterOpen}
        onClose={() => setCounterOpen(false)}
      />
      <ScheduleSessionModal
        session={sessionToSchedule}
        open={Boolean(sessionToSchedule)}
        onClose={() => setSessionToSchedule(undefined)}
        onSave={(update) => {
          if (!sessionToSchedule) return;
          scheduleSession(swap.id, sessionToSchedule.id, update);
          setSessionToSchedule(undefined);
          toast.success("Session scheduled");
        }}
      />
    </main>
  );
}

function OfferSummary({
  title,
  name,
  sessions,
  duration,
}: {
  title: string;
  name: string;
  sessions: number;
  duration: number;
}) {
  return (
    <div className="rounded-lg border border-line bg-canvas p-5">
      <p className="text-xs font-bold uppercase text-muted">{title}</p>
      <h3 className="mt-2 text-xl font-bold">{name}</h3>
      <p className="mt-2 text-sm text-muted">
        {sessions} sessions × {duration} minutes
      </p>
      <p className="mt-3 font-bold text-brand-700">
        {sessions * duration} min total
      </p>
    </div>
  );
}
function SessionColumn({
  title,
  skill,
  sessions,
  onSchedule,
  onComplete,
  currentUserId,
}: {
  title: string;
  skill: string;
  sessions: SwapSession[];
  onSchedule: (session: SwapSession) => void;
  onComplete: (session: SwapSession) => void;
  currentUserId: string;
}) {
  return (
    <div className="surface overflow-hidden">
      <header className="border-b border-line bg-canvas p-5">
        <p className="text-xs font-bold uppercase text-muted">{title}</p>
        <div className="mt-1 flex justify-between">
          <h3 className="text-xl font-bold">{skill}</h3>
          <strong className="text-brand-700">
            {sessions.filter((s) => s.status === "completed").length} /{" "}
            {sessions.length}
          </strong>
        </div>
      </header>
      <div className="divide-y divide-line">
        {sessions.map((session) => (
          <article key={session.id} className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex gap-3">
                <span
                  className={`grid size-8 place-items-center rounded-full ${session.status === "completed" ? "bg-brand-600 text-white" : "bg-slate-100 text-muted"}`}
                >
                  {session.status === "completed" ? (
                    <Check size={16} />
                  ) : (
                    <Circle size={14} />
                  )}
                </span>
                <div>
                  <p className="font-bold">
                    {skill} session {session.sessionNumber}
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    {session.scheduledAt
                      ? new Date(session.scheduledAt).toLocaleString([], {
                          day: "numeric",
                          month: "long",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "Not scheduled"}{" "}
                    · {session.durationMinutes} min
                  </p>
                  {session.meetingLink && (
                    <a
                      href={session.meetingLink}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-brand-700"
                    >
                      <LinkIcon size={13} />
                      Meeting link
                    </a>
                  )}
                  {session.location && (
                    <p className="mt-2 flex items-center gap-1 text-xs text-muted">
                      <MapPin size={13} />
                      {session.location}
                    </p>
                  )}
                </div>
              </div>
              <Badge
                tone={
                  session.status === "completed"
                    ? "green"
                    : session.status === "scheduled"
                      ? "blue"
                      : "neutral"
                }
              >
                {session.status}
              </Badge>
            </div>
            {session.status === "unscheduled" && (
              <Button
                variant="secondary"
                className="mt-4 w-full"
                onClick={() => onSchedule(session)}
              >
                <CalendarDays size={16} />
                Schedule
              </Button>
            )}
            {session.status === "scheduled" && (
              <Button
                variant="secondary"
                className="mt-4 w-full"
                onClick={() => onComplete(session)}
              >
                <Check size={16} />
                {session.teacherId === currentUserId
                  ? "Mark completed"
                  : "Confirm completion"}
              </Button>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
function ScheduleSessionModal({
  session,
  open,
  onClose,
  onSave,
}: {
  session?: SwapSession;
  open: boolean;
  onClose: () => void;
  onSave: (
    update: Pick<
      SwapSession,
      "scheduledAt" | "deliveryMode" | "meetingLink" | "location"
    >,
  ) => void;
}) {
  const [date, setDate] = useState("2026-08-25T18:00");
  const [mode, setMode] = useState<"online" | "in_person" | "both">(
    session?.deliveryMode ?? "online",
  );
  const [detail, setDetail] = useState("");
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Schedule ${session?.skillName ?? ""} session`}
      description={`Session ${session?.sessionNumber ?? ""} · ${session?.durationMinutes ?? ""} minutes`}
    >
      <label>
        <span className="label">Date and time</span>
        <input
          className="field"
          type="datetime-local"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </label>
      <label className="mt-4 block">
        <span className="label">Delivery mode</span>
        <select
          className="field"
          value={mode}
          onChange={(e) => setMode(e.target.value as typeof mode)}
        >
          <option value="online">Online</option>
          <option value="in_person">In person</option>
          <option value="both">Both</option>
        </select>
      </label>
      <label className="mt-4 block">
        <span className="label">
          {mode === "online" ? "Meeting link" : "Meeting location"}{" "}
          <span className="font-normal text-muted">(optional)</span>
        </span>
        <input
          className="field"
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          placeholder={
            mode === "online"
              ? "https://meet.example.com/..."
              : "Address or meeting place"
          }
        />
      </label>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          onClick={() =>
            onSave({
              scheduledAt: new Date(date).toISOString(),
              deliveryMode: mode,
              meetingLink: mode === "online" ? detail : undefined,
              location: mode === "in_person" ? detail : undefined,
            })
          }
        >
          Save schedule
        </Button>
      </div>
    </Modal>
  );
}
