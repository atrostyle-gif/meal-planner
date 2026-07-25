type ComingSoonProps = {
  title: string;
  description: string;
};

/** 未実装画面のプレースホルダー */
export function ComingSoon({ title, description }: ComingSoonProps) {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      <div className="rounded-2xl bg-surface-container px-5 py-10 text-center">
        <p className="font-medium text-on-surface">準備中です</p>
        <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">
          {description}
        </p>
      </div>
    </div>
  );
}
