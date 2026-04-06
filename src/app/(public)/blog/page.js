import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { AnimatedSection, AnimatedStagger, AnimatedItem } from '@/app/components/landing/AnimatedSection';
import { BLOG_POSTS } from '@/data/blog';

export const metadata = {
  title: 'Blog | Voco',
  description: 'AI receptionist tips, guides, and news for home service contractors.',
  alternates: {
    canonical: 'https://voco.live/blog',
  },
};

export default function BlogPage() {
  return (
    <div className="bg-white">
      {/* Header */}
      <section className="bg-[#F5F5F4] pt-24 md:pt-28 pb-16 md:pb-20">
        <div className="max-w-6xl mx-auto px-6">
          <AnimatedSection>
            <h1 className="text-4xl md:text-5xl font-semibold text-[#0F172A] tracking-tight">
              Blog
            </h1>
            <p className="text-lg text-[#475569] mt-4 max-w-xl leading-relaxed">
              Tips, guides, and insights for home service contractors.
            </p>
          </AnimatedSection>
        </div>
      </section>

      {/* Card grid */}
      <section className="bg-white">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <AnimatedStagger className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {BLOG_POSTS.map((post) => (
              <AnimatedItem key={post.slug}>
                <Link href={`/blog/${post.slug}`} className="block group h-full">
                  <Card className="bg-white rounded-2xl shadow-[0_1px_3px_0_rgba(0,0,0,0.04),0_1px_2px_-1px_rgba(0,0,0,0.03)] border border-stone-200/60 hover:shadow-[0_4px_12px_0_rgba(0,0,0,0.06)] hover:-translate-y-0.5 transition-all duration-200 overflow-hidden gap-0 p-0 h-full">
                    {/* Featured image placeholder */}
                    <div className="aspect-[16/9] bg-[#F5F5F4] rounded-t-2xl" />

                    {/* Card body */}
                    <div className="p-5 flex flex-col gap-3 flex-1">
                      {/* Badge */}
                      <span className="inline-flex items-center bg-[#F97316]/10 text-[#F97316] text-xs font-medium rounded-full px-2.5 py-0.5 w-fit">
                        BLOG
                      </span>

                      {/* Title */}
                      <h2 className="text-base font-semibold text-[#0F172A] leading-snug">
                        {post.title}
                      </h2>

                      {/* Excerpt */}
                      <p className="text-sm text-[#475569] line-clamp-2 leading-relaxed">
                        {post.excerpt}
                      </p>

                      {/* Footer */}
                      <div className="flex items-center justify-between mt-auto pt-2">
                        <span className="text-xs text-[#64748B]">
                          {new Date(post.publishedAt).toLocaleDateString('en-US', {
                            month: 'long',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                        <span className="text-sm text-[#F97316] font-medium flex items-center gap-1 group-hover:gap-1.5 transition-all">
                          Read article
                          <ArrowRight className="size-3.5" />
                        </span>
                      </div>
                    </div>
                  </Card>
                </Link>
              </AnimatedItem>
            ))}
          </AnimatedStagger>
        </div>
      </section>
    </div>
  );
}
