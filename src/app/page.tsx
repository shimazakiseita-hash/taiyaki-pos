import Link from "next/link";

const LINKS = [
  { href: "/register", label: "レジ", note: "レジPC" },
  { href: "/kitchen", label: "キッチン", note: "キッチンPC" },
  { href: "/display", label: "呼び出し表示", note: "お客さん向け" },
  { href: "/admin", label: "管理", note: "責任者" },
] as const;

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-xl flex-1 p-6">
      <h1 className="mb-8 text-center text-3xl font-bold">
        🐟 およげない！たいやきくん
      </h1>
      <ul className="grid gap-4">
        {LINKS.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className="flex min-h-20 items-center justify-between rounded-2xl border-2 border-amber-700 bg-white px-6 text-2xl font-bold shadow-sm active:bg-amber-100"
            >
              <span>{l.label}</span>
              <span className="text-base font-normal text-gray-600">
                {l.note} → {l.href}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
