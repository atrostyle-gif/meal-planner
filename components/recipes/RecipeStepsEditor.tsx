"use client";

type StepDraft = {
  key: string;
  text: string;
};

type RecipeStepsEditorProps = {
  steps: StepDraft[];
  onChange: (steps: StepDraft[]) => void;
};

export type { StepDraft };

function emptyStep(): StepDraft {
  return { key: crypto.randomUUID(), text: "" };
}

/** 調理手順の追加・削除・上下入れ替え */
export function RecipeStepsEditor({ steps, onChange }: RecipeStepsEditorProps) {
  function updateText(key: string, text: string): void {
    onChange(steps.map((step) => (step.key === key ? { ...step, text } : step)));
  }

  function addStep(): void {
    onChange([...steps, emptyStep()]);
  }

  function removeStep(key: string): void {
    if (steps.length <= 1) {
      onChange([emptyStep()]);
      return;
    }
    onChange(steps.filter((step) => step.key !== key));
  }

  function moveStep(key: string, direction: -1 | 1): void {
    const index = steps.findIndex((step) => step.key === key);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= steps.length) {
      return;
    }

    const next = [...steps];
    const current = next[index];
    next[index] = next[target];
    next[target] = current;
    onChange(next);
  }

  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium text-on-surface">調理手順</legend>
      <div className="space-y-3">
        {steps.map((step, index) => (
          <div
            key={step.key}
            className="space-y-2 rounded-2xl bg-surface-container-lowest p-3 ring-1 ring-outline-variant"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-on-surface">
                手順 {index + 1}
              </p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => moveStep(step.key, -1)}
                  disabled={index === 0}
                  className="rounded-lg px-2 py-1 text-sm text-on-surface-variant disabled:opacity-30"
                  aria-label="上へ移動"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => moveStep(step.key, 1)}
                  disabled={index === steps.length - 1}
                  className="rounded-lg px-2 py-1 text-sm text-on-surface-variant disabled:opacity-30"
                  aria-label="下へ移動"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => removeStep(step.key)}
                  className="rounded-lg px-2 py-1 text-sm text-error hover:bg-error-container"
                  aria-label="手順を削除"
                >
                  削除
                </button>
              </div>
            </div>
            <textarea
              value={step.text}
              onChange={(event) => updateText(step.key, event.target.value)}
              rows={2}
              className="w-full resize-y rounded-xl border-0 bg-surface-container px-3 py-2.5 text-base outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary"
              placeholder="工程の内容を入力"
            />
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={addStep}
        className="text-sm font-medium text-primary"
      >
        ＋ 手順を追加
      </button>
    </fieldset>
  );
}

export function createEmptyStepDraft(): StepDraft {
  return emptyStep();
}

export function stepsToDrafts(
  steps: Array<{ id: string; text: string }>,
): StepDraft[] {
  if (steps.length === 0) {
    return [emptyStep()];
  }
  return steps.map((step) => ({ key: step.id, text: step.text }));
}
