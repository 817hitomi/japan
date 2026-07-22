import LoginClient from "./LoginClient";

type LoginPageProps = { searchParams: Promise<{ error?: string; next?: string }> };

function safeAdminPath(value?: string) {
  return value?.startsWith("/admin") && !value.startsWith("//") ? value : "/admin";
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const error = params.error === "forbidden" || params.error === "configuration" ? params.error : undefined;
  return <LoginClient error={error} nextPath={safeAdminPath(params.next)} />;
}

