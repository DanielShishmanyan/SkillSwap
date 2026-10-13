import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertTriangle,
  ArrowRightLeft,
  CalendarRange,
  CheckCircle2,
  Clock3,
} from "lucide-react";
import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { useAppStore } from "../../app/app-store.context";
import {
  calculateSwapBalance,
  findCompatibleSkillPairs,
} from "../../features/swaps/swaps.utils";
import {
  swapProposalSchema,
  type SwapProposalValues,
} from "../../features/swaps/swaps.validation";
import type { Swap, UserProfile } from "../../types/domain";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";

const durations = [30, 45, 60, 90, 120] as const;
export function SwapModal({
  user,
  swap,
  open,
  onClose,
}: {
  user?: UserProfile;
  swap?: Swap;
  open: boolean;
  onClose: () => void;
}) {
  const { currentUser, createSwap, counterSwap } = useAppStore();
  const pairs = user ? findCompatibleSkillPairs(currentUser, user) : [];
  const currentIsRequester = !swap || swap.requesterId === currentUser.id;
  const ownExistingOffer = swap
    ? currentIsRequester
      ? swap.requesterOffer
      : swap.receiverOffer
    : undefined;
  const otherExistingOffer = swap
    ? currentIsRequester
      ? swap.receiverOffer
      : swap.requesterOffer
    : undefined;
  const requesterSkills = [
    ...new Map(
      pairs.map((pair) => [pair.requesterSkill.id, pair.requesterSkill]),
    ).values(),
  ];
  const receiverSkills = [
    ...new Map(
      pairs.map((pair) => [pair.receiverSkill.id, pair.receiverSkill]),
    ).values(),
  ];
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SwapProposalValues>({
    resolver: zodResolver(swapProposalSchema),
    defaultValues: {
      requesterSkillId:
        ownExistingOffer?.skillId ?? requesterSkills[0]?.id ?? "",
      receiverSkillId:
        otherExistingOffer?.skillId ?? receiverSkills[0]?.id ?? "",
      requesterSessions: ownExistingOffer?.sessionsCount ?? 2,
      receiverSessions: otherExistingOffer?.sessionsCount ?? 2,
      requesterDuration: ownExistingOffer?.minutesPerSession ?? 60,
      receiverDuration: otherExistingOffer?.minutesPerSession ?? 60,
      deliveryMode: swap?.deliveryMode ?? "online",
      preferredStartDate: swap?.preferredStartDate ?? "",
      preferredEndDate: swap?.preferredEndDate ?? "",
      message: swap?.requesterMessage ?? "",
    },
  });
  // Reset when the modal is reopened for a different proposal.
  useEffect(() => {
    if (open)
      reset({
        requesterSkillId:
          ownExistingOffer?.skillId ?? requesterSkills[0]?.id ?? "",
        receiverSkillId:
          otherExistingOffer?.skillId ?? receiverSkills[0]?.id ?? "",
        requesterSessions: ownExistingOffer?.sessionsCount ?? 2,
        receiverSessions: otherExistingOffer?.sessionsCount ?? 2,
        requesterDuration: ownExistingOffer?.minutesPerSession ?? 60,
        receiverDuration: otherExistingOffer?.minutesPerSession ?? 60,
        deliveryMode: swap?.deliveryMode ?? "online",
        preferredStartDate: swap?.preferredStartDate ?? "",
        preferredEndDate: swap?.preferredEndDate ?? "",
        message: swap?.requesterMessage ?? "",
      });
    // The proposal identity is the reset boundary; including derived arrays would reset while editing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, swap?.id]);
  const values = useWatch({ control });
  if (!user) return null;
  const requesterSkill = requesterSkills.find(
    (skill) => skill.id === values.requesterSkillId,
  );
  const receiverSkill = receiverSkills.find(
    (skill) => skill.id === values.receiverSkillId,
  );
  const requesterOffer = {
    skillId: requesterSkill?.id ?? "",
    skillName: requesterSkill?.name ?? "",
    sessionsCount: Number(values.requesterSessions) || 1,
    minutesPerSession: Number(values.requesterDuration || 60) as
      30 | 45 | 60 | 90 | 120,
  };
  const receiverOffer = {
    skillId: receiverSkill?.id ?? "",
    skillName: receiverSkill?.name ?? "",
    sessionsCount: Number(values.receiverSessions) || 1,
    minutesPerSession: Number(values.receiverDuration || 60) as
      30 | 45 | 60 | 90 | 120,
  };
  const balance = calculateSwapBalance(requesterOffer, receiverOffer);
  const submit = (data: SwapProposalValues) => {
    const offered = requesterSkills.find((s) => s.id === data.requesterSkillId);
    const received = receiverSkills.find((s) => s.id === data.receiverSkillId);
    if (!offered || !received) {
      toast.error("The selected skills are no longer compatible.");
      return;
    }
    const ownOffer = {
      skillId: offered.id,
      skillName: offered.name,
      sessionsCount: data.requesterSessions,
      minutesPerSession: data.requesterDuration as 30 | 45 | 60 | 90 | 120,
    };
    const otherOffer = {
      skillId: received.id,
      skillName: received.name,
      sessionsCount: data.receiverSessions,
      minutesPerSession: data.receiverDuration as 30 | 45 | 60 | 90 | 120,
    };
    const update = {
      requesterOffer: currentIsRequester ? ownOffer : otherOffer,
      receiverOffer: currentIsRequester ? otherOffer : ownOffer,
      deliveryMode: data.deliveryMode,
      preferredStartDate: data.preferredStartDate || undefined,
      preferredEndDate: data.preferredEndDate || undefined,
      requesterMessage: data.message || undefined,
    };
    if (swap) {
      counterSwap(swap.id, update);
      toast.success("Counter offer sent");
    } else {
      createSwap({ receiverId: user.id, ...update });
      toast.success("Skill swap proposal sent");
    }
    onClose();
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={swap ? "Send a counter offer" : "Propose a skill swap"}
      description={`Agree on what each person will teach. Sessions are scheduled after ${user.name.split(" ")[0]} accepts.`}
    >
      {pairs.length === 0 ? (
        <div className="rounded-md bg-amber-50 p-4 text-sm text-amber-800">
          Your skills are no longer mutually compatible.
        </div>
      ) : (
        <form onSubmit={handleSubmit(submit)}>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr]">
            <OfferEditor
              title="I teach"
              name="requester"
              skills={requesterSkills}
              register={register}
              errors={errors}
            />
            <span className="mx-auto grid size-9 place-items-center self-center rounded-full bg-brand-100 text-brand-700">
              <ArrowRightLeft size={18} />
            </span>
            <OfferEditor
              title={`${user.name.split(" ")[0]} teaches`}
              name="receiver"
              skills={receiverSkills}
              register={register}
              errors={errors}
            />
          </div>
          <div
            className={`mt-4 rounded-md border p-4 ${balance.balanced ? "border-brand-200 bg-brand-50" : "border-amber-200 bg-amber-50"}`}
          >
            <div className="flex items-center gap-2 font-bold">
              {balance.balanced ? (
                <CheckCircle2 size={18} className="text-brand-700" />
              ) : (
                <AlertTriangle size={18} className="text-amber-700" />
              )}
              {balance.balanced ? "Balanced swap" : "Uneven swap"}
            </div>
            <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted">
              <span>
                You offer: <strong>{balance.requesterMinutes} min</strong>
              </span>
              <span>
                You receive: <strong>{balance.receiverMinutes} min</strong>
              </span>
              {!balance.balanced && (
                <span>
                  Difference: <strong>{balance.difference} min</strong>
                </span>
              )}
            </div>
            {!balance.balanced && (
              <p className="mt-2 text-xs leading-5 text-amber-800">
                This exchange is uneven. You can still send it if both users are
                happy with the arrangement.
              </p>
            )}
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <label>
              <span className="label">Delivery mode</span>
              <select
                className="field capitalize"
                {...register("deliveryMode")}
              >
                <option value="online">Online</option>
                <option value="in_person">In person</option>
                <option value="both">Both</option>
              </select>
            </label>
            <label>
              <span className="label">Preferred from</span>
              <input
                type="date"
                className="field"
                {...register("preferredStartDate")}
              />
            </label>
            <label>
              <span className="label">Preferred until</span>
              <input
                type="date"
                className="field"
                {...register("preferredEndDate")}
              />
              {errors.preferredEndDate && (
                <span className="mt-1 block text-xs text-red-600">
                  {errors.preferredEndDate.message}
                </span>
              )}
            </label>
          </div>
          <label className="mt-4 block">
            <span className="label">
              Message <span className="font-normal text-muted">(optional)</span>
            </span>
            <textarea
              className="field h-24 py-3"
              placeholder="Share your availability or what you want to focus on..."
              {...register("message")}
            />
          </label>
          <div className="mt-6 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting}>
              {swap ? "Send counter offer" : "Send proposal"}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function OfferEditor({
  title,
  name,
  skills,
  register,
  errors,
}: {
  title: string;
  name: "requester" | "receiver";
  skills: UserProfile["teaches"];
  register: ReturnType<typeof useForm<SwapProposalValues>>["register"];
  errors: ReturnType<typeof useForm<SwapProposalValues>>["formState"]["errors"];
}) {
  return (
    <div className="rounded-md border border-line p-4">
      <p className="eyebrow">{title}</p>
      <select className="field mt-2 font-bold" {...register(`${name}SkillId`)}>
        {skills.map((skill) => (
          <option key={skill.id} value={skill.id}>
            {skill.name}
          </option>
        ))}
      </select>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <label>
          <span className="mb-1 flex items-center gap-1 text-[11px] font-bold text-muted">
            <CalendarRange size={12} />
            Sessions
          </span>
          <select
            className="field"
            {...register(`${name}Sessions`, { valueAsNumber: true })}
          >
            {[1, 2, 3, 4, 5, 6, 8, 10].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="mb-1 flex items-center gap-1 text-[11px] font-bold text-muted">
            <Clock3 size={12} />
            Each
          </span>
          <select
            className="field"
            {...register(`${name}Duration`, { valueAsNumber: true })}
          >
            {durations.map((n) => (
              <option key={n} value={n}>
                {n} min
              </option>
            ))}
          </select>
        </label>
      </div>
      {errors[`${name}Sessions`] && (
        <Badge tone="red" className="mt-2">
          Invalid session count
        </Badge>
      )}
    </div>
  );
}
