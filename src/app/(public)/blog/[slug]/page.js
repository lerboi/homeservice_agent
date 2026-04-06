import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { AnimatedSection } from '@/app/components/landing/AnimatedSection';
import { AuthAwareCTA } from '@/components/landing/AuthAwareCTA';
import { SchemaMarkup } from '@/components/SchemaMarkup';
import { BLOG_POSTS } from '@/data/blog';

export async function generateStaticParams() {
  return BLOG_POSTS.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const post = BLOG_POSTS.find((p) => p.slug === slug);

  if (!post) {
    return { title: 'Not Found | Voco' };
  }

  return {
    title: `${post.title} | Voco`,
    description: post.excerpt,
    alternates: {
      canonical: `https://voco.live/blog/${slug}`,
    },
    openGraph: {
      title: `${post.title} | Voco`,
      description: post.excerpt,
      images: [
        {
          url: `https://voco.live/og?title=${encodeURIComponent(post.title)}&type=BLOG`,
          width: 1200,
          height: 630,
          alt: post.title,
        },
      ],
    },
  };
}

export default async function BlogDetailPage({ params }) {
  const { slug } = await params;
  const post = BLOG_POSTS.find((p) => p.slug === slug);

  if (!post) {
    notFound();
  }

  // Parse content into sections by splitting on ## headings
  const sections = post.content
    .split(/^## /m)
    .filter(Boolean)
    .map((section) => {
      const lines = section.split('\n');
      const heading = lines[0].trim();
      const body = lines.slice(1).join('\n').trim();
      return { heading, body };
    });

  // Related posts
  const relatedPosts = post.relatedSlugs
    .map((s) => BLOG_POSTS.find((p) => p.slug === s))
    .filter(Boolean);

  return (
    <div className="bg-white">
      <SchemaMarkup
        schema={{
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: post.title,
          datePublished: post.publishedAt,
          author: {
            '@type': 'Organization',
            name: 'Voco',
          },
          publisher: {
            '@type': 'Organization',
            name: 'Voco',
          },
        }}
      />

      <article className="max-w-2xl mx-auto px-6 py-16 md:py-24">
        {/* Back to hub */}
        <Link
          href="/blog"
          className="inline-flex items-center gap-1.5 text-sm text-[#64748B] hover:text-[#0F172A] transition-colors mb-8"
        >
          <ArrowLeft className="size-4" />
          All articles
        </Link>

        {/* Featured image */}
        <div className="aspect-[16/9] w-full rounded-xl overflow-hidden bg-[#F5F5F4] mb-8">
          {post.featuredImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={post.featuredImage}
              alt={post.title}
              className="w-full h-full object-cover"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          )}
        </div>

        {/* Article header */}
        <AnimatedSection>
          <h1 className="text-4xl md:text-5xl font-semibold text-[#0F172A] mt-8 leading-tight tracking-tight">
            {post.title}
          </h1>
          <p className="text-sm text-[#64748B] mt-3">
            {new Date(post.publishedAt).toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
        </AnimatedSection>

        {/* Article content */}
        <div className="mt-10 max-w-[65ch]">
          {sections.map((section, i) => (
            <section key={i} className="mb-8">
              <h2 className="text-2xl md:text-3xl font-semibold text-[#0F172A] mt-12 mb-4">
                {section.heading}
              </h2>
              {section.body.split('\n\n').map((paragraph, j) => {
                if (!paragraph.trim()) return null;
                // Handle markdown bold and list items in a basic way
                return (
                  <p key={j} className="text-base text-[#475569] leading-relaxed mb-4">
                    {paragraph}
                  </p>
                );
              })}
            </section>
          ))}
        </div>

        {/* Related posts */}
        {relatedPosts.length > 0 && (
          <div className="mt-16 pt-10 border-t border-stone-200">
            <h2 className="text-xl font-semibold text-[#0F172A] mb-6">Related articles</h2>
            <div className="space-y-4">
              {relatedPosts.map((related) => (
                <Link
                  key={related.slug}
                  href={`/blog/${related.slug}`}
                  className="block group p-4 rounded-xl border border-stone-200/60 hover:border-[#F97316]/40 hover:shadow-[0_4px_12px_0_rgba(0,0,0,0.06)] transition-all"
                >
                  <p className="text-sm font-semibold text-[#0F172A] group-hover:text-[#F97316] transition-colors">
                    {related.title}
                  </p>
                  <p className="text-xs text-[#64748B] mt-1 line-clamp-1">{related.excerpt}</p>
                </Link>
              ))}
            </div>
          </div>
        )}
      </article>

      {/* CTA section */}
      <AnimatedSection>
        <section className="bg-[#F5F5F4] py-16 md:py-20">
          <div className="max-w-2xl mx-auto px-6 text-center">
            <h2 className="text-2xl md:text-3xl font-semibold text-[#0F172A] mb-4 tracking-tight">
              Stop missing calls. Start booking more jobs.
            </h2>
            <p className="text-[#475569] mb-8 leading-relaxed">
              Set up your AI receptionist in under 5 minutes. No tech skills required.
            </p>
            <AuthAwareCTA variant="cta" />
          </div>
        </section>
      </AnimatedSection>
    </div>
  );
}
