"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function MatchRedirect({ params }: { params: { id: string } }) {
  const router = useRouter();
  useEffect(() => {
    router.replace(`/betting/football/${params.id}`);
  }, [params.id, router]);
  return null;
}
