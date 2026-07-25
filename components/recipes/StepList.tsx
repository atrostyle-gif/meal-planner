import type { RecipeStep } from "@/types/recipe";

type StepListProps = {
  steps: RecipeStep[];
};

/** 番号付きの調理手順表示（料理中に見やすい大きめレイアウト） */
export function StepList({ steps }: StepListProps) {
  const ordered = [...steps].sort((left, right) => left.order - right.order);

  if (ordered.length === 0) {
    return <p className="text-base text-on-surface-variant">手順は未登録です</p>;
  }

  return (
    <ol className="space-y-4">
      {ordered.map((step) => (
        <li key={step.id} className="flex gap-3">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-base font-bold text-on-primary"
            aria-hidden
          >
            {step.order}
          </span>
          <p className="pt-1 text-lg leading-relaxed text-on-surface">{step.text}</p>
        </li>
      ))}
    </ol>
  );
}
