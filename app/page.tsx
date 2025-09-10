import Image from "next/image";
import ConnectButton from "../components/ConnectButton";
import BuyForm from "../components/BuyForm";
import Referral from "../components/Referral";
import ClaimWidget from "@/components/ClaimWidget"; // цей лишається через src/

export default function Home() {
  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center text-white p-10 relative"
      style={{
        backgroundImage: "url('/assets/bg.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="bg-black/70 rounded-2xl p-8 text-center max-w-xl w-full">
        <div className="flex justify-center mb-6">
          <Image src="/assets/logo.png" alt="Magic Time Logo" width={120} height={120} />
        </div>

        <h1 className="text-4xl font-bold mb-6">Magic Time (MAGT) Presale</h1>

        <ConnectButton />

        <p className="mt-4 text-lg">
          Підключи гаманець і купи токени <span className="font-bold">MAGT</span>
        </p>

        {/* Реферальне посилання з’явиться після підключення гаманця */}
        <Referral />

        {/* Форма покупки з урахуванням рівнів та реф-коментарем */}
        <BuyForm />

        {/* Віджет для клейму */}
        <div className="mt-6">
          <ClaimWidget />
        </div>
      </div>
    </main>
  );
}
