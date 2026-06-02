import { createFileRoute } from "@tanstack/react-router"
import { Logo } from "@/components/Logo"

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
})

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground p-6 max-w-2xl mx-auto">
      <div className="mb-8 pt-4">
        <Logo size="md" />
      </div>

      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold mb-2">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground">Last updated: June 2025</p>
        </div>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">1. Overview</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Twined is a private shared life application designed exclusively 
            for two people in a relationship. We are committed to protecting 
            your personal information and being transparent about what data 
            we collect and why. This policy applies to all users of the 
            Twined mobile and web application.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">2. Information We Collect</h2>
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li>
              <span className="font-medium text-foreground">Account information</span>
              <p>Your email address and password used to create and access your account.</p>
            </li>
            <li>
              <span className="font-medium text-foreground">Profile information</span>
              <p>Your display name, profile photo, timezone, and chosen avatar preset.</p>
            </li>
            <li>
              <span className="font-medium text-foreground">Content you create</span>
              <p>Tasks, moments (text, photos, voice notes, short videos), shared 
                lists, and any other content you post within the app.</p>
            </li>
            <li>
              <span className="font-medium text-foreground">Location data</span>
              <p>GPS coordinates collected only when you explicitly start a sharing 
                session on the Map tab by tapping "Start Sharing My Day". Location 
                is never collected passively or in the background. You can stop 
                sharing at any time.</p>
            </li>
            <li>
              <span className="font-medium text-foreground">Interaction data</span>
              <p>Basic usage data such as when thinking pings are sent between 
                partners and timestamps of activity.</p>
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">3. How We Use Your Information</h2>
          <ul className="space-y-1 text-sm text-muted-foreground list-disc pl-4">
            <li>To provide and operate the Twined service</li>
            <li>To sync your data in real time with your paired partner</li>
            <li>To send notifications when your partner posts a moment, 
              updates their tasks, or sends a thinking ping</li>
            <li>To display your location trail on the map to your partner 
              during active sharing sessions</li>
            <li>To improve and maintain the app</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">4. Data Sharing</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Your data is shared only with your paired partner within your 
            private space. We do not sell, rent, or share your personal 
            information with any third parties for marketing purposes.
          </p>
          <p className="text-sm text-muted-foreground font-medium">We use the following third-party services to operate Twined:</p>
          <ul className="space-y-1 text-sm text-muted-foreground list-disc pl-4">
            <li><span className="font-medium text-foreground">Supabase</span> — 
              database, authentication, file storage, and real-time data sync</li>
            <li><span className="font-medium text-foreground">Mapbox</span> — 
              map rendering and location display</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">5. Location Data</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Location data is one of the most sensitive categories of personal 
            information. We take the following approach:
          </p>
          <ul className="space-y-1 text-sm text-muted-foreground list-disc pl-4">
            <li>Location is only collected when you actively start a sharing session</li>
            <li>Location data is only visible to your paired partner</li>
            <li>Daily trail data is stored and viewable in archive</li>
            <li>You can stop sharing at any time by tapping "Stop" on the Map tab</li>
            <li>We never sell or share location data with advertisers or third parties</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">6. Data Retention</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Your data is retained for as long as your account is active. If you 
            leave your shared space or delete your account, your personal data 
            will be removed from our systems within 30 days. Media files (photos, 
            voice notes, videos) may take up to 90 days to be fully purged 
            from storage.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">7. Your Rights</h2>
          <p className="text-sm text-muted-foreground">You have the right to:</p>
          <ul className="space-y-1 text-sm text-muted-foreground list-disc pl-4">
            <li>Access the personal data we hold about you</li>
            <li>Request correction of inaccurate data</li>
            <li>Request deletion of your account and data</li>
            <li>Withdraw consent for location sharing at any time</li>
            <li>Export your data upon request</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">8. Security</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            We use industry-standard security measures including encrypted data 
            transmission (HTTPS), secure authentication via Supabase Auth, and 
            row-level security policies that ensure each user can only access 
            data within their own private space. No other users or spaces can 
            access your data.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">9. Children's Privacy</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Twined is not intended for use by anyone under the age of 13. We do 
            not knowingly collect personal information from children under 13. 
            If you believe a child has provided us with personal information, 
            please contact us and we will delete it promptly.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">10. Changes to This Policy</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            We may update this privacy policy from time to time. We will notify 
            you of significant changes by posting the new policy in the app. 
            Your continued use of Twined after changes are posted constitutes 
            acceptance of the updated policy.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">11. Contact</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            If you have any questions about this privacy policy or how we handle 
            your data, please contact us at:
          </p>
          <p className="text-sm font-medium">syedshahrozerizvi@gmail.com</p>
        </section>
      </div>

      <footer className="mt-12 pt-6 border-t border-border text-center text-xs text-muted-foreground space-y-2">
        <p>© 2026 Twined. All rights reserved.</p>
        <p>Two people. One quiet shared window.</p>
      </footer>
    </div>
  )
}
