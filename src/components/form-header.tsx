// The report form's page header, shared by New and Edit so the two read as the
// same screen in two states. One sentence under the title says how the form
// ends, which is the thing a first-time author does not know: nothing is
// filed until they submit, and a draft can be left and come back to.
export function FormHeader({
  eyebrow,
  title,
}: {
  eyebrow: string;
  title: string;
}) {
  return (
    <header className="space-y-2">
      <p className="type-eyebrow">{eyebrow}</p>
      <h1 className="type-title text-balance">{title}</h1>
      <p className="type-subtitle">
        Save a draft at any point and come back to it. Nothing reaches a
        reviewer until you submit.
      </p>
    </header>
  );
}
