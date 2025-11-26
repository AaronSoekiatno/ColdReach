import { Hero } from "@/components/Hero";
import { Features } from "@/components/Features";
import { StartupsCarousel } from "@/components/StartupsCarousel";

const Index = () => {
  return (
    <main className="min-h-screen">
      <Hero />
      <StartupsCarousel />
      <Features />
    </main>
  );
};

export default Index;
