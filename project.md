SnapClaim: Business Requirements Document
8 Oct 2026 · @Abdulazeez UmarFaruq
Overview and purpose
SnapClaim is an Android app that turns a photo of a paper receipt into a clean expense line, and lets you hand over a monthly report that the person reimbursing you can check has not been edited since you sealed it. It is built for CLOCK IN, the Solana Mobile hackathon, and designed to keep growing after it.
It is for freelancers, remote contractors and Web3 contributors who claim expenses back from a client or a DAO. This document sets what ships by the October 12 submission, what comes later, and what the build can be held to.
Item
Detail
Product
SnapClaim: Android app, small backend, landing page
Builder
Abdulazeez UmarFaruq, solo
Event
CLOCK IN, the Solana Mobile Hackathon, run with RadiantsDAO
Submission due
13 Oct 2026, 00:59 GMT+1 (the end of Oct 12 in Nigeria), per the official Clock In site
Network
Solana devnet only for the hackathon build, with no real funds
Hackathon deliverables
Working Android APK, GitHub repo, demo video, short pitch deck
Problem, users and goals
People who claim expenses retype paper receipts into spreadsheets at month end, and the person paying receives a file that could have been changed after it was filed. SnapClaim removes the retyping and adds a check that the report is unchanged.
Users
Persona
Who
What they need
Claimant
Freelancer, contractor or Web3 contributor reimbursed by a client or a DAO
Scan receipts as they happen, fix a wrong field fast, send one clean monthly report
Reviewer
Client finance contact or DAO treasurer
Open the report and confirm it is the same one the claimant sealed. No app needed, only the verify page
Goals
1. Ship a working APK, repo, demo video and deck for the CLOCK IN deadline.
2. Score on the four judging criteria: stickiness, user experience, innovation, and presentation.
3. Leave a project worth continuing: a tool the builder would use for his own freelance expenses.
Success measures (proposed targets, to be checked on the builder's own receipts)
Measure
Target
Scan to saved expense, including corrections
Under 30 seconds
Fields parsed correctly on printed receipts without edits
80% across 20 real receipts
Seal then verify
Sealed report shows Match; changing one character shows No match
Demo
Full flow in under 3 minutes, recorded on a real phone
Stickiness is the weakest criterion for this product. The plan to address it is a running monthly total on the home screen and a weekly reminder to scan receipts (Should have, see scope).
Scope
The hackathon build is the Must row. It is a full, usable app for one job, not a half finished tour of ideas. Everything below it is written down so the work can continue after October 12.
Bucket
What is in it
Must (by Oct 12)
Wallet connect with the Mobile Wallet Adapter. Receipt capture and gallery import. AI parsing with an editable review screen. Expense log grouped by month. Monthly report with a fingerprint. Seal on Solana devnet. Verify inside the app. Release APK, README, and a landing page with the APK link and demo
Should (if time allows)
Weekly reminder notification. CSV export. PDF export. A verify page on the website for reviewers. Crop and flash tools on the camera
Later (Phase 2)
Categories and tags. Multi currency totals. Team workspaces with an approval step. Reimbursement payout flow. Optional SKR integration for the separate SKR prize. Solana dApp Store publishing. Encrypted receipt images. Accounting exports
Out of scope
Creating or editing receipts, since the app only reads receipts the user photographs. Handwritten receipts. A custom Solana program. Mainnet and real funds. iOS
The hackathon says winners must publish on the Solana dApp Store to claim a prize. That is a Phase 2 task and only matters if the project places.
Functional requirements: mobile app
The app has 25 requirements, 19 of them Must. Each one can be tested with a yes or no.
ID
Feature
Requirement
Priority
FR-1
Wallet
The user connects a wallet app through the Mobile Wallet Adapter and sees a shortened address
Must
FR-2
Wallet
The app signs the user in with a signed message. It never sees or stores a private key
Must
FR-3
Capture
The user photographs a receipt in the app's camera view
Must
FR-4
Capture
The user imports a receipt image from the gallery
Must
FR-5
Capture
The camera has a flash toggle, and the user can crop before upload
Should
FR-6
Parsing
The image goes to the backend, which returns vendor, date, subtotal, tax, total and currency as structured fields
Must
FR-7
Parsing
Parsing shows a loading state and ends with either the fields or a clear error
Must
FR-8
Review
The user sees every parsed field beside the receipt image and can edit each one before saving
Must
FR-9
Review
Fields the model was unsure about are marked for checking
Should
FR-10
Review
If parsing fails, the user can type the fields by hand and still save the expense
Must
FR-11
Log
Saved expenses are listed by month with a running total
Must
FR-12
Log
The user can open, edit and delete an expense
Must
FR-13
Log
The user can view the original receipt image from an expense
Must
FR-14
Report
The user generates a report for a chosen month listing every expense and the totals
Must
FR-15
Report
The report is put into one fixed canonical form and a SHA-256 fingerprint of it is shown
Must
FR-16
Report
The user exports the report as CSV
Should
FR-17
Report
The user exports the report as PDF
Should
FR-18
Seal
Sealing builds a devnet memo transaction holding the fingerprint, asks the wallet to sign it, and sends it
Must
FR-19
Seal
After confirmation the report shows Sealed, the transaction signature and an explorer link, and becomes read only
Must
FR-20
Seal
If signing is declined or the network fails, the report stays a draft and the user can retry
Must
FR-21
Seal
Changing a sealed month's expenses creates a new draft version. The sealed version is kept
Must
FR-22
Verify
The user picks a report, or pastes a fingerprint and a transaction signature, and the app shows Match or No match
Must
FR-23
Verify
A web page lets a reviewer verify the same way without installing the app
Should
FR-24
Reminders
A weekly notification reminds the user to scan receipts
Should
FR-25
Safety
A visible banner shows the app runs on devnet with no real funds
Must
Landing page requirements
The landing page is a single, complete page that explains the product, gives judges the APK and demo in one tap, and hosts the reviewer's verify page. It is not a placeholder.
Section
What it holds
Hero
One headline saying what SnapClaim does, one supporting line, and three buttons: Download APK, Watch the demo, View on GitHub. A real screenshot of the app beside it
How it works
Three steps with real screenshots: Scan the receipt, Check the fields, Seal the month
What sealing proves
A plain explanation. It proves the report is unchanged since it was sealed. It does not prove the receipts are genuine
Who it is for
Short blocks for the claimant and the reviewer
Verify a report
A form for the fingerprint and transaction signature that returns Match or No match (Should have, matches FR-23)
FAQ
Devnet and no real funds. Where receipt images are kept and who can see them. Which phones it runs on. That it is not yet on the Solana dApp Store
Footer
GitHub link, contact link, and a line saying it was built for CLOCK IN, the Solana Mobile Hackathon
Technical notes
• A static, mobile first site on a free host. The APK is linked from a GitHub release, not stored in the page.
• The page loads in under 3 seconds on mobile data (proposed target) and has no horizontal scroll at phone width.
• Open Graph title, description and image so a shared link looks right.
• The verify page reads the devnet transaction from a public RPC in the browser. No secret keys are placed in the page.
• Screenshots come from the real app on a real phone. No invented testimonials, user counts or partner logos.
Non functional requirements
Receipts carry personal details and the app handles a wallet, so privacy and security come before extra features. Numbers below are proposed targets.
Area
Requirement
Performance
The camera opens in under 2 seconds. A receipt is parsed in under 10 seconds on a normal connection. Images are compressed on the phone before upload
Privacy
Receipts and parsed fields are stored against the wallet address only. The user can delete an expense and its image. No third party analytics. The first run screen and the FAQ say that receipt images are sent to an AI provider for reading
Security
The AI provider key and database credentials live only on the backend, never in the APK. Every request carries a token tied to the wallet signature. Parsing is rate limited. File type and size are checked. HTTPS only. The app never handles a private key
Reliability
A failed parse falls back to manual entry. Sealing is safe to retry and cannot seal the same report version twice. With no connection the app shows a clear offline message. Offline queueing is Phase 2
Compatibility
Android phones. Tested on one physical phone and the Android Studio emulator. It uses the Mobile Wallet Adapter as Solana Mobile describes, but it is not tested on a Seeker, which the builder does not own
Accessibility
Text follows the system font size. Tap targets are at least 48 dp. Buttons have labels. Text meets contrast guidance
Maintainability
A README lets someone clone, configure and run the app and backend in about 15 minutes. An example environment file lists every setting
Integrity of purpose
The app only reads receipts the user photographs. It has no feature that creates or alters a receipt
Architecture, data model and Solana integration
The phone talks to one backend and one wallet app, and only a fingerprint of the report is written to Solana.
The backend reads receipts through an AI vision model and stores expenses and images. The wallet app signs the memo transaction. The app and the verify page both read that memo back from devnet.
Stack (proposed)
Layer
Choice
Note
Mobile app
React Native development build
Not Expo Go, because wallet signing needs native code
Wallet
Mobile Wallet Adapter
As described in the Solana Mobile docs
Backend
Node with Express or NestJS
The builder's existing stack
Data
MongoDB, with receipt images in file storage
Decide the image store on day one
AI vision
A vision model, called only from the backend
Check the current model and limits first
Chain
Solana devnet, one memo instruction
No custom program
Landing page
Static site
Hosts the optional verify page
Data model
Collection
Main fields
users
Wallet address, created at
expenses
Id, owner, vendor, date, currency, subtotal, tax, total, image reference, parse status, created at, updated at
reports
Id, owner, month, version, expense snapshot, canonical text, fingerprint, status (draft or sealed), transaction signature, sealed at, cluster
How sealing works
1. The app builds the report's canonical text: expenses sorted by date, keys in a fixed order, amounts as fixed decimal strings.
2. The SHA-256 hash of that text is the fingerprint.
3. The app builds one transaction with a memo instruction holding the fingerprint, and asks the wallet to sign and send it to devnet.
4. The transaction signature is saved with the report, and the report becomes read only.
How verifying works
Anyone with the report and the transaction signature rebuilds the canonical text, hashes it, reads the memo from the devnet transaction, and compares. A match means the report is exactly what was sealed, at the time of that transaction. It does not show that the receipts were genuine, or that nothing was left out before sealing.
Screens and user flows
The app has nine screens, and three flows cover everything a user does.
Screen
Purpose
Key elements
Welcome and connect
Say what the app does and connect a wallet
One line description, Connect wallet button, note that receipts are read by an AI provider, devnet note
Home
Show the month at a glance
Month total, recent expenses, Scan button, tabs for Reports and Verify, devnet banner
Capture
Take or import a receipt photo
Camera view, flash, gallery import, crop
Review
Check what the AI read
Receipt image, editable fields, flagged fields, Save, manual entry if parsing fails
Expense detail
Look at one expense
Fields, receipt image, edit, delete
Reports
Build a monthly report
Month picker, expense list, totals, fingerprint, Seal button, export
Seal
Confirm and sign
Summary, fingerprint, wallet signing prompt, success state with the transaction link
Verify
Check a report
Choose a report or paste a fingerprint and signature, result of Match or No match
Settings
Manage the account
Disconnect wallet, delete data, about and devnet explanation
Scan flow
1. The user taps Scan on Home and photographs or imports a receipt.
2. The image is compressed and sent to the backend for reading.
3. The Review screen shows the fields beside the image. The user corrects any field.
4. The user taps Save and returns to Home, where the month total has updated.
Report flow
1. The user opens Reports and picks a month.
2. The user checks the list and totals, and the app shows the fingerprint.
3. The user taps Seal and the wallet app asks for a signature.
4. The app shows Sealed with the transaction link. The report is now read only.
Verify flow
1. The user opens Verify and chooses a report or pastes a fingerprint and a transaction signature.
2. The app reads the memo from the devnet transaction and compares it to the fingerprint.
3. The app shows Match or No match.
Timeline and submission checklist
The build ends on October 11, which leaves October 12 to test a clean install and submit. The deadline is 00:59 GMT+1 on October 13.
The landing page runs beside the report work so it never blocks the app. If a day ends behind, cut a Should item, not the demo or the clean install test.
Submission checklist
[ ] Registered on the Clock In site, with the solo team set up
[ ] Release APK that installs on a clean phone
[ ] GitHub repository with a README and an example environment file
[ ] Demo video of the full flow, about 3 minutes, recorded on a real phone
[ ] Short pitch deck
[ ] Landing page live with the APK link
[ ] Submitted by the afternoon of Oct 12, with the confirmation saved
Risks, assumptions and open questions
The biggest risk is time: one builder, four and a half days, and a native build to set up. When something slips, cut the Should items first and keep the single scan to seal flow working.
Risk
Mitigation
Four days is tight for a solo build
Hold to the Must list. Cut Should items in order: PDF, reminders, crop and flash, web verify page
The borrowed phone is not available when needed
Ask for it today. Develop on the emulator with a test wallet until then
Wallet signing needs a native build, not Expo Go
Set up the development build on day one and prove wallet connection before writing any other screen
Devnet faucet limits delay test transactions
Request devnet SOL early and keep a second wallet as backup
The AI vision model is slow, costly or unavailable
Check which vision model the provider offers now. Keep manual entry as a working fallback. Printed receipts only
Receipts are misread (dates, currencies, totals)
Editable review screen, with unsure fields flagged
Receipt images are personal data sent to a third party
Say so in the app and FAQ. Allow deletion. Test only with the builder's own receipts
Sealing is read as proof the receipts are real
State plainly in the app, site and deck that sealing proves the report is unchanged, nothing more
The AI key leaks from the APK
Keep it on the backend only and rate limit parsing
The rules require work started during the event
Build SnapClaim from a fresh repository. Check the Event Info page rules
The deadline is unclear (the blog said Oct 8, the Clock In site says Oct 13)
The builder confirmed Oct 13 on the organisers' page. Re-check the registration site and submit by the afternoon of Oct 12
Judges find it low on stickiness
Running monthly total, weekly reminder, and an honest Phase 2 roadmap in the deck
Assumptions
• The builder has Android Studio and will use a borrowed Android phone for testing and the demo video.
• Free tiers cover hosting, the database and the devnet RPC for the length of the hackathon.
• Solo entries are allowed, as the Clock In page says.
Open questions
[ ] Which vision model will parse receipts, and what are its limits and costs today?
[ ] Does the Clock In submission form require a particular format for the pitch deck?
[ ] Where will the backend run during judging, and for how long?