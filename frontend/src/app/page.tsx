import { cookies } from "next/headers";
import { useRouter } from 'next/navigation';
import isNil from "lodash/isNil"

export default function Home() {
  const c = cookies()
  const sessionKey = c.get("session_key")
  const router = useRouter();

  if(isNil(sessionKey) || sessionKey.value.length === 0){
    router.push("/login")
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">

    </main>
  )
}
