# Fidelity Funeral Services

A digital home for families in Zimbabwe and the diaspora when they lose someone. It brings funeral planning, cover, burial arrangements, remembrance and aftercare into one place, so a grieving family has one place to go instead of many phone calls.

![New Landing page of Fidelity Funeral Services](https://github.com/rose-aiia/-fidelity-funeral-services-system/blob/main/frontend/docs/screenshots/cuirrenthomepage.png)

## Who it is for

- **Families who need help now**: someone has just passed away and they need to know what to do next.
- **People planning ahead**: comparing funeral plans for themselves or their family.
- **Policyholders**: checking their cover and asking for help, such as making a claim.
- **Relatives and friends**: remembering a loved one and leaving a tribute, wherever they live.
- **Funeral professionals**: managing the services they deliver for families.

## What families can do

### Start a funeral case or request cover

At `/funeral-support`, a policyholder or relative can enter a policy number, review the matched sample policy and covered members, then submit funeral details and a service checklist. Fidelity staff review policy terms and assign the case stages. A walk-in client can select a plan and requested services, then submit online or ask to complete the application at a Fidelity office.

### Get help straight away

The first thing on the page is a way to reach a funeral care adviser. Urgent arrangements, transport, repatriation questions and cemetery guidance all start from here.

### Choose a funeral plan

Compare three plans (**Essential**, **Comfort** and **Legacy**), see what each one covers, and request a quote that fits the family's size and wishes.

### Find a burial place

Search cemeteries by town or area, compare plot guidance and send an enquiry about a grave.

### Bring someone home

Repatriation support for families abroad: an overview of the journey, transport and the documents needed to arrange a funeral across borders.

### Remember a loved one

Create an online memorial with their life story and photographs. Keep it private until it is ready, then publish and share the link. Visitors can leave flowers, light a candle and write a tribute, and the family reads every tribute before it is shown.

### Arrange everything else

A marketplace of trusted partners for what a funeral needs: headstones and plaques, wreaths, marquee and seating hire, programmes and stationery, and memorial video tributes.

### Stay supported afterwards

Aftercare does not stop at the funeral. Families get guidance on next steps, estate help and ideas for remembrance, including AI-assisted suggestions.

## Your account

Customers sign in with their mobile number and a one-time code, with no password to remember. From their account they can:

- **Link their policy** and see who is covered and for how much.
- **Ask for help**, for example "a loved one has passed away" or "make a claim", choose how they want to be contacted (phone call, WhatsApp or SMS) and follow the request from *received* to *complete*.
- **Manage memorials** they have created: story, photos, tributes and sharing.
- **Keep their profile** up to date.

## For the team behind it

A staff portal at `/provider-portal` for administrators and funeral service providers. What each person sees depends on who they are:

- **Administrators** see every family and every request. Urgent requests (a bereavement nobody has taken on) are at the top. They assign a request to a funeral service provider, follow orders, look up any customer, add or switch off providers, and read an activity log of every change.
- **Funeral providers** (a funeral director, for example) see only the requests handed to them, and accept, decline or complete each one. The family sees the progress, but never the internal note an administrator wrote.
- **Marketplace vendors** (a florist, a stonemason) see only the orders that include their products, and confirm, prepare and deliver them. An order shared with another vendor is coordinated by an administrator.

Switching a provider off stops new requests going to them and hides their products from the marketplace.

## Run the application

The frontend defaults to the live API (`VITE_API_MODE=live`) and the backend defaults to port 4000. Configure the database, secure session secret, live SMS provider, and WhatsApp bridge before starting customer or staff services. Do not use sample policy or demo identity information in a production deployment.

Development and deployment requirements are in [frontend/docs/development.md](frontend/docs/development.md).

## Policy workbook imports

Administrators can upload approved Excel policy workbooks using either supported layout. Signed-in customers can register policy-covered funeral cases or request walk-in coverage consultations; Fidelity administrators can assign coordinators. With explicit reporter consent, the WhatsApp bridge creates a private group for the verified contact and adds assigned Fidelity staff. Customers can invite relatives only after confirming their consent. Cases, assignments, group status, participant consent and audit events are stored server-side.

Apply the Prisma migrations, provision the first administrator using the guarded `backend` `npm run admin:provision` command and the required `ADMIN_PHONE`, `ADMIN_FIRST_NAME`, `ADMIN_LAST_NAME`, and `ALLOW_ADMIN_PROVISIONING=I_UNDERSTAND` environment values, and configure live SMS before enabling customer access. WhatsApp group creation also requires a connected bridge paired to a dedicated Fidelity-owned number and an enabled sending setting. The bridge uses Baileys, an unofficial WhatsApp Web client; obtain explicit compliance approval before production deployment. Real groups are created only after the reporter's consent is recorded.

## Project layout

| Folder | What it is |
| --- | --- |
| `frontend/` | The web app (Vite + React). Run with `npm run dev` on port 5173. |
| `backend/` | The API (Express + Prisma). Copy `.env.example` to `.env`, then `npm run dev` on port 4000. |

![Old Landing page of Fidelity Funeral Services](frontend/docs/screenshots/landing-page.png)
