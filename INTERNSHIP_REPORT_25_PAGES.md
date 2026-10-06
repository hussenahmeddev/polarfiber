# HARAMAYA UNIVERSITY
## COLLEGE OF COMPUTING AND INFORMATICS
### DEPARTMENT OF INFORMATION TECHNOLOGY

\newpage

---

# FINAL INTERNSHIP PRACTICAL ATTACHMENT REPORT
## ON
## DESIGN AND IMPLEMENTATION OF A SECURE FULL-STACK WEB-BASED MANAGEMENT AND E-COMMERCE SYSTEM FOR POLAR FIBER

---

### **Submitted in Partial Fulfillment of the Requirements for the Degree of Bachelor of Science in Information Technology**

\vspace{1.5cm}

| **Field** | **Details** |
| :--- | :--- |
| **Student Name:** | **Hussen Ahmed** |
| **Student ID:** | **1608/16** |
| **Department:** | Department of Information Technology |
| **College:** | College of Computing and Informatics |
| **University:** | Haramaya University, Ethiopia |
| **Hosting Organization:** | **Polar Fiber Enterprise** (Addis Ababa, Ethiopia) |
| **Company Supervisor:** | **Teha Mohammed** (Information System & Infrastructure Lead) |
| **University Advisor:** | **Mekonnen (M.Sc.)** (Department of Information Technology) |
| **Internship Period:** | **July 9, 2026 – August 28, 2026** (Summer Practical Attachment) |
| **Submission Date:** | **October 2026** |

\newpage

---

# DECLARATION AND APPROVAL

### **Student's Declaration**
I, **Hussen Ahmed** (ID: **1608/16**), hereby declare that this internship report entitled **"Design and Implementation of a Secure Full-Stack Web-Based Management and E-Commerce System for Polar Fiber"** is an authentic record of my own practical work carried out during the summer internship attachment at **Polar Fiber**, Addis Ababa, from July 9, 2026 to August 28, 2026. This report has been prepared under the joint supervision of my academic advisor **Mekonnen (M.Sc.)** and company supervisor **Ato Teha Mohammed**, and it has not been submitted previously for the award of any degree, diploma, or certificate at this or any other institution.

\vspace{0.8cm}
**Student Name:** Hussen Ahmed  
**Signature:** ___________________________  
**Date:** _______________________________  

\vspace{1.5cm}

---

### **Approval of the Mentors and Supervisors**

This is to certify that the internship report submitted by **Hussen Ahmed** (ID: **1608/16**) has been reviewed and approved for submission in partial fulfillment of the requirements for the Degree of Bachelor of Science in Information Technology at Haramaya University.

\vspace{1.0cm}

**Approved by University Advisor:**  
**Name:** Mekonnen (M.Sc.)  
**Designation:** Lecturer, Department of Information Technology  
**Institution:** Haramaya University  
**Signature:** ___________________________  
**Date:** _______________________________  

\vspace{1.0cm}

**Approved by Hosting Company Supervisor:**  
**Name:** Teha Mohammed  
**Designation:** Information System & Technology Development Lead  
**Organization:** Polar Fiber  
**Signature:** ___________________________  
**Date:** _______________________________  

\newpage

---

# EXECUTIVE SUMMARY

The rapid digital transformation across Ethiopia's manufacturing sector necessitates transitioning from traditional, manual business workflows to resilient, cloud-connected software systems. This internship report documents a comprehensive eight-week summer practical attachment undertaken at **Polar Fiber**, a premier plastic manufacturing enterprise located in Addis Ababa, Ethiopia, specializing in food-grade rotomolded water tankers (backed by a 10-year warranty), fiber pipes, flower pots, and roofing sheets. 

Prior to this attachment, Polar Fiber maintained a static online showcase without transactional capabilities, product availability indexes, or systematic customer order management. Crucial business operations—such as quote estimation, product catalog inquiries, inventory status tracking, and order confirmations—relied heavily on informal voice phone calls, physical paper receipts, and unindexed emails. This operational model suffered from high customer friction, communication overhead, order fulfillment delays, and lack of operational analytics.

Assigned to the **Information System, Technology Development & Infrastructure** division, the intern spearheaded the design, engineering, and deployment of a modern, full-stack web-based enterprise portal and e-commerce management platform. The engineering architecture leverages **TanStack Start** with **React 19**, **Vite**, **TypeScript**, and **Tailwind CSS v4** on the frontend/application tier, connected via strict SSL/TLS encryption to an **Aiven Cloud MySQL 8** managed database backend. 

Key technical achievements of the project include:
1. **High-Performance Public Storefront & Quotation Engine**: An interactive, responsive catalog with deep product specifications and an integrated quotation submission system.
2. **Tamper-Proof E-Commerce Ordering Pipeline**: Implementation of client-side cart persistence paired with strict server-side price validation and ACID-compliant database transaction processing in Ethiopian Birr (ETB).
3. **Role-Based Authentication & Cryptographic Session Security**: An isolated RBAC schema with automated administrator provisioning, password salting via bcryptjs, and HMAC-SHA256 cookie signing verified through constant-time comparison (`crypto.timingSafeEqual`).
4. **Unified Operations Dashboard**: An administrative control suite providing real-time CRUD management over inventory, pipeline state tracking for orders, quote inquiry correspondence, and customer auditing.

This attachment afforded profound improvements in the intern's software engineering capabilities, system modeling skills, database architecture proficiency, team communication, and understanding of industrial workplace psychology and entrepreneurship.

\newpage

---

# ACKNOWLEDGEMENTS

First and foremost, I express my deepest gratitude to the Almighty God for providing me with strength, health, wisdom, and perseverance throughout my academic journey and the completion of this internship program.

I express my profound gratitude to **Haramaya University**, the **College of Computing and Informatics**, and the **Department of Information Technology** for integrating this invaluable practical attachment program into our undergraduate curriculum, bridging academic concepts with industrial reality.

I extend my sincere appreciation to my University Advisor, **Ato Mekonnen (M.Sc.)**, for his continuous technical guidance, insightful critiques, academic advice, and support during the evaluation of this project.

I am deeply indebted to **Polar Fiber** for welcoming me into their enterprise and providing me with the resources and operational freedom to analyze and modernize their information infrastructure. Special thanks go to my industry supervisor, **Ato Teha Mohammed** (Information System & Infrastructure Lead), whose technical mentorship, domain expertise, daily encouragement, and constructive feedback were instrumental in shaping the engineering solutions detailed in this report.

Lastly, I extend my heartfelt love and thanks to my family, colleagues, and fellow IT classmates for their endless moral support, motivation, and camaraderie throughout my academic studies.

\newpage

---

# LIST OF ACRONYMS AND ABBREVIATIONS

| Acronym | Definition |
| :--- | :--- |
| **API** | Application Programming Interface |
| **ACID** | Atomicity, Consistency, Isolation, Durability |
| **B2B** | Business-to-Business |
| **B2C** | Business-to-Consumer |
| **CA** | Certificate Authority |
| **CRUD** | Create, Read, Update, Delete |
| **CSRF** | Cross-Site Request Forgery |
| **CSS** | Cascading Style Sheets |
| **DDL** | Data Definition Language |
| **DOM** | Document Object Model |
| **ERD** | Entity-Relationship Diagram |
| **ETB** | Ethiopian Birr |
| **HMAC** | Hash-based Message Authentication Code |
| **HTML** | HyperText Markup Language |
| **HTTP** | HyperText Transfer Protocol |
| **HTTPS** | HyperText Transfer Protocol Secure |
| **IT** | Information Technology |
| **JSON** | JavaScript Object Notation |
| **LLDPE** | Linear Low-Density Polyethylene |
| **PEM** | Privacy Enhanced Mail (Certificate format) |
| **RBAC** | Role-Based Access Control |
| **REST** | Representational State Transfer |
| **SHA** | Secure Hash Algorithm |
| **SQL** | Structured Query Language |
| **SSL** | Secure Sockets Layer |
| **SSR** | Server-Side Rendering |
| **TLS** | Transport Layer Security |
| **UI** | User Interface |
| **URI** | Uniform Resource Identifier |
| **UX** | User Experience |
| **Vite** | Next Generation Frontend Tooling |

\newpage

---

# LIST OF TABLES AND FIGURES

### **List of Tables**
* **Table 1.1**: Polar Fiber Product Catalog & Engineering Specifications ...................................... Page 3
* **Table 2.1**: Academic Coursework Integration Matrix ..................................................................... Page 8
* **Table 2.2**: Comprehensive Technology and Tooling Stack ........................................................... Page 9
* **Table 4.1**: Comprehensive Student Self-Evaluation .................................................................... Page 25

### **List of Figures**
* **Figure 1.1**: Polar Fiber Enterprise Organizational Hierarchy ........................................................ Page 4
* **Figure 2.1**: Iterative Sectional Workflow Pipeline ......................................................................... Page 7
* **Figure 3.1**: Three-Tier Full-Stack System Architecture ................................................................. Page 14
* **Figure 3.2**: Complete Entity-Relationship Diagram (ERD) ............................................................. Page 16

\newpage

---

# TABLE OF CONTENTS

1. **CHAPTER ONE: INTRODUCTION & COMPANY PROFILE** ..................................................... Page 1
   - 1.1 Background of the Organization .......................................................................................... Page 1
   - 1.2 Vision, Mission, and Core Values ......................................................................................... Page 2
   - 1.3 Main Products and Services of Polar Fiber ........................................................................... Page 2
   - 1.4 Target Customers and End Users ......................................................................................... Page 3
   - 1.5 Organizational Structure ..................................................................................................... Page 4
   - 1.6 Existing Industrial Workflows and Limitations ..................................................................... Page 5
2. **CHAPTER TWO: OVERALL INTERNSHIP EXPERIENCE & TASK EXECUTION** ........................... Page 6
   - 2.1 Motivation for Selecting Polar Fiber ..................................................................................... Page 6
   - 2.2 Placement Section: Information System & Infrastructure ...................................................... Page 6
   - 2.3 Sectional Workflow and Task Execution ................................................................................ Page 7
   - 2.4 Practical Application of Academic Coursework .................................................................... Page 8
   - 2.5 Development Tools and Technology Matrix .......................................................................... Page 9
   - 2.6 Industrial Challenges Encountered and Solutions Applied .................................................... Page 10
3. **CHAPTER THREE: THE PROJECT — SYSTEM DESIGN & IMPLEMENTATION** ........................... Page 11
   - 3.1 Project Title and Summary .................................................................................................. Page 11
   - 3.2 Problem Statement & Justification ....................................................................................... Page 11
   - 3.3 Objectives of the Project ..................................................................................................... Page 12
   - 3.4 Project Scope ...................................................................................................................... Page 13
   - 3.5 System Architecture (Three-Tier Model) ................................................................................ Page 14
   - 3.6 Database Modeling & Schema Design ................................................................................. Page 15
   - 3.7 Security Architecture and Implementation ........................................................................... Page 17
   - 3.8 User Flow & System Interaction .......................................................................................... Page 19
   - 3.9 Implementation Results & Discussion ................................................................................. Page 20
4. **CHAPTER FOUR: BENEFITS GAINED & REFLECTION** .......................................................... Page 21
   - 4.1 Upgrading Practical & Technical Skills ................................................................................ Page 21
   - 4.2 Consolidating Theoretical Knowledge ................................................................................. Page 21
   - 4.3 Industrial Problem-Solving Capabilities ................................................................................ Page 22
   - 4.4 Team Dynamics, Work Ethics, and Leadership ..................................................................... Page 22
   - 4.5 Entrepreneurship and Interpersonal Communication ........................................................... Page 24
   - 4.6 Self-Evaluation: Strengths and Areas for Growth ................................................................ Page 25
5. **CHAPTER FIVE: CONCLUSION & RECOMMENDATIONS** ...................................................... Page 26
   - 5.1 Overall Conclusion .............................................................................................................. Page 26
   - 5.2 Recommendations for the Hosting Organization (Polar Fiber) ............................................. Page 26
   - 5.3 Recommendations for Haramaya University Internship Program ........................................... Page 27
6. **REFERENCES** .................................................................................................................... Page 28
7. **APPENDICES** ...................................................................................................................... Page 29

\newpage

---

# CHAPTER ONE: INTRODUCTION & COMPANY PROFILE

## 1.1 Background of the Organization
**Polar Fiber** is a prominent Ethiopian industrial manufacturing and distribution enterprise headquartered in Addis Ababa (specifically located in the Jemoo Furi 2 industrial corridor). Founded to address the critical domestic demand for safe, durable, and affordable fluid containment and construction materials, Polar Fiber specializes in rotational molding (rotomolding) and blow-molding technologies. 

The company's premier engineering product line consists of high-density, multi-layered water storage tankers engineered from 100% food-grade, UV-stabilized Linear Low-Density Polyethylene (LLDPE). Polar Fiber distinguishes itself within the Ethiopian manufacturing sector by providing a **10-year structural warranty** on its water storage products—a commitment reflecting high manufacturing precision, tensile resilience, and thermal stability in harsh climatic conditions (-10°C to 60°C).

In addition to water tankers ranging from 500 liters to 25,000 liters, Polar Fiber manufactures molded decorative garden flower pots, industrial fiber drainage and supply pipes, and weatherproof corrugated fiber roofing sheets. The company presents its brand online at `polarfiber.com.et`.

## 1.2 Vision, Mission, and Core Values

### **Vision Statement**
> *"To become the most reliable and technologically innovative manufacturer of fluid storage and building products in East Africa, ensuring every household, agricultural enterprise, and industrial facility has uncompromised access to clean, affordable, and eco-friendly water management solutions."*

### **Mission Statement**
> *"To engineer high-durability, hygienic, and climate-resilient polymer products locally in Addis Ababa using state-of-the-art molding technologies, exceptional raw materials, and customer-centric service, contributing to national infrastructural resilience and water security."*

### **Core Values**
* **Quality & Integrity**: Refusal to compromise on material standards; utilization of non-toxic, BPA-free polymers.
* **Customer Commitment**: Providing dependable warranties, responsive quoting, and long-term customer assistance.
* **Innovation & Agility**: Continuous refinement of industrial molding techniques, digital interfaces, and supply chain responsiveness.
* **Environmental Stewardship**: Manufacturing long-lasting, recyclable polymer goods that minimize water leakage and contamination.

## 1.3 Main Products and Services of Polar Fiber

```
+-------------------------------------------------------------------------------------------------------+
| TABLE 1.1: Polar Fiber Product Catalog & Engineering Specifications                                   |
+-------------------+----------------------+------------------------------------+-----------------------+
| Category          | Sample Models        | Engineering Specifications         | Primary Application   |
+-------------------+----------------------+------------------------------------+-----------------------+
| Water Tankers     | Polar Tanker 500L    | Rotomolded LLDPE, UV-Stabilized,   | Residential Homes,    |
|                   | Polar Tanker 1,000L  | Food-Grade, Anti-Bacterial Liner,  | Small Businesses,     |
|                   | Polar Tanker 2,000L  | Seamless Body, Threaded Lid,       | Construction Sites,   |
|                   | Polar Tanker 5,000L  | 10-Year Warranty.                  | Agriculture, Large    |
|                   | Polar Tanker 10,000L |                                    | Industrial Plants.    |
|                   | Polar Tanker 25,000L |                                    |                       |
+-------------------+----------------------+------------------------------------+-----------------------+
| Flower Pots       | Garden Molded Pots   | High Impact Polyethylene,          | Landscaping, Hotels,  |
|                   |                      | Weather-Resistant, Decorative.     | Urban Residential.    |
+-------------------+----------------------+------------------------------------+-----------------------+
| Roof Sheets       | Fiber Corrugated     | Reinforced Composite Fiber,        | Warehouses, Sheds,    |
|                   | Roofing Sheets       | Corrosion-Free, Heat-Reflective.   | Residential Roofing.  |
+-------------------+----------------------+------------------------------------+-----------------------+
| Fiber Pipes       | Fiber Pipe 4"        | High-Pressure Burst Resistance,    | Potable Water Lines,  |
|                   | (and various gauges) | Smooth Inner Bore, Chemical Proof. | Irrigation, Drainage. |
+-------------------+----------------------+------------------------------------+-----------------------+
```

## 1.4 Target Customers and End Users
Polar Fiber caters to a broad demographic spanning private households, government institutions, and industrial conglomerates across Ethiopia:
* **Urban Households & Residential Developers**: Seeking dependable 500L–2,000L potable water backup systems.
* **Commercial Establishments**: Hotels, hospitals, universities, schools, and shopping plazas requiring 5,000L–10,000L storage.
* **Agricultural Farms & Agro-Industries**: Requiring high-volume reservoirs (10,000L–25,000L).
* **Civil Contractors & Infrastructure Engineers**: Purchasing fiber pipes, corrugated roofing sheets, and tankers.

## 1.5 Organizational Structure
Polar Fiber operates under a corporate structure headed by the CEO, coordinating Production & Quality Assurance, Sales & Marketing, Customer Service & Logistics, and Information System, Technology Development & Infrastructure.

## 1.6 Existing Industrial Workflows and Limitations
Prior to this attachment, customer inquiries and orders were handled manually over the telephone and recorded on physical paper slips, creating communication overhead, inventory mismatches, and a complete absence of managerial reporting metrics.

\newpage

---

# CHAPTER TWO: OVERALL INTERNSHIP EXPERIENCE & TASK EXECUTION

## 2.1 Motivation for Selecting Polar Fiber
Polar Fiber was selected because it presented an active real-world manufacturing company requiring a full-stack digital transformation. This allowed the intern to apply end-to-end software engineering from requirements analysis to cloud database architecture and full-stack development.

## 2.2 Placement Section: Information System & Infrastructure
Assigned to the Information System division under **Ato Teha Mohammed**, tasks involved auditing existing web assets, modeling business data, building a full-stack application, and securing data transactions.

## 2.3 Chronological Task Execution
* **Weeks 1–2**: System audit, catalog data elicitation, product specification compilation.
* **Weeks 3–4**: Relational schema design (3NF), Aiven Cloud MySQL 8 configuration, SSL setup.
* **Weeks 5–6**: TanStack Start server functions, React 19 UI, shopping cart, quotation engine.
* **Week 7**: Security hardening (HMAC-SHA256, bcryptjs, RBAC), administrative operations dashboard.
* **Week 8**: Testing, quality assurance, stakeholder review, and report documentation.

## 2.4 Practical Application of Academic Coursework

```
+-------------------------------------------------------------------------------------------------------+
| TABLE 2.1: Academic Coursework Integration Matrix                                                     |
+------------------------------------+------------------------------------------------------------------+
| Academic Course (Haramaya Univ.)   | Direct Industrial Application at Polar Fiber                     |
+------------------------------------+------------------------------------------------------------------+
| Web Systems & Technologies         | Architected React 19 UI with Vite, Tailwind CSS v4, SSR,         |
|                                    | and dynamic routing via TanStack Start.                          |
+------------------------------------+------------------------------------------------------------------+
| Database Systems & Design          | Designed 3rd Normal Form relational schema, foreign key          |
|                                    | constraints, indexes, and ACID transaction blocks in MySQL 8.    |
+------------------------------------+------------------------------------------------------------------+
| Computer Security & Cryptography   | Implemented HMAC-SHA256 session signatures, bcryptjs salting,     |
|                                    | timing-safe comparisons, and SSL/TLS CA certificate validation.  |
+------------------------------------+------------------------------------------------------------------+
| Systems Analysis and Design        | Conducted feasibility studies, requirements gathering, DFD       |
|                                    | drafting, and user journey optimization.                         |
+------------------------------------+------------------------------------------------------------------+
```

## 2.5 Development Tools and Technology Matrix

```
+-------------------------------------------------------------------------------------------------------+
| TABLE 2.2: Comprehensive Technology and Tooling Stack                                                 |
+----------------------+---------------------------------+----------------------------------------------+
| Layer / Dimension    | Technology / Tool               | Rationale & Role                             |
+----------------------+---------------------------------+----------------------------------------------+
| Frontend Framework   | React 19 + TypeScript           | Component modularity and static type safety. |
| Full-Stack Engine    | TanStack Start + Vite 8         | Fast server functions, SSR, type-safe routes.|
| Styling Engine       | Tailwind CSS v4 + Radix UI      | Modern, responsive, accessible UI components.|
| State & Caching      | TanStack Query v5               | Efficient caching and server-state sync.     |
| Database Engine      | Aiven Cloud MySQL 8             | Managed cloud database with high availability|
| DB Client Driver     | mysql2/promise                  | Edge-compatible per-request connection pool. |
| Security / Crypto    | Node.js crypto + bcryptjs       | HMAC-SHA256 signatures and password hashing. |
| Schema Validation    | Zod                             | Strict runtime validation for API endpoints. |
| Version Control      | Git & GitHub                    | Source control and collaborative tracking.   |
| IDE & Productivity   | VS Code + Antigravity IDE       | Code compilation, testing, and debugging.    |
+----------------------+---------------------------------+----------------------------------------------+
```

## 2.6 Industrial Challenges Encountered and Solutions Applied
* **Unstructured Product Information**: Synthesized factory specs and formulated automated MySQL seeder scripts (`db/setup.mjs`).
* **Cloud SSL Certificate Parsing**: Engineered a dynamic PEM reconstruction routine (`normalizeCa`) in `backend/db.server.ts`.
* **Zero-Trust Pricing**: Forced all order subtotals and unit prices to be re-queried and calculated directly on the server from MySQL.

\newpage

---

# CHAPTER THREE: THE PROJECT — SYSTEM DESIGN & IMPLEMENTATION

## 3.1 Project Title and Summary
**Project Title**: *Design and Implementation of a Secure Full-Stack Web-Based Management and E-Commerce System for Polar Fiber*

**Summary**: An enterprise full-stack web application replacing manual sales workflows with automated digital cataloging, quote management, tamper-proof ordering, customer portals, and an administrative control console.

## 3.2 Problem Statement & Objectives
* **General Objective**: To engineer and deploy a secure, full-stack web application digitizing Polar Fiber's catalog, quote requests, customer ordering, and administrative management.
* **Specific Objectives**:
  1. Build a browsable, responsive catalog for all 4 product families with ETB pricing.
  2. Implement an instant quote submission engine with administrative review.
  3. Deploy a shopping cart and customer order history portal.
  4. Build an administrative dashboard for catalog CRUD, order pipelines, and quote statuses.
  5. Enforce enterprise security (HMAC-SHA256 signed cookies, bcryptjs, RBAC).

## 3.3 Three-Tier System Architecture
1. **Presentation Tier**: React 19, TypeScript, Tailwind CSS v4, Lucide Icons.
2. **Application Tier**: TanStack Start Server Functions (`createServerFn`), Zod validation, Node.js Crypto.
3. **Data Tier**: Aiven Cloud MySQL 8, SSL/TLS Encryption, `mysql2/promise`.

## 3.4 Relational Database Schema (`db/schema.sql`)
The database contains 7 normalized tables: `categories`, `products`, `users`, `user_roles`, `orders`, `order_items`, and `quote_requests`.

## 3.5 Security Architecture & Implementation
* **Session Cryptography**: Base64url payload `{ uid, exp }` signed with HMAC-SHA256 and compared using `crypto.timingSafeEqual()`.
* **RBAC**: Separate `user_roles` table. The first registered user automatically becomes system admin.
* **ACID Order Transactions**: Orders and line items are committed inside `c.beginTransaction()` / `c.commit()`.

\newpage

---

# CHAPTER FOUR: BENEFITS GAINED & REFLECTION

## 4.1 Practical and Theoretical Skill Growth
* Gained mastery over React 19, TanStack Start, cloud database administration, and SSL/TLS certificate handling.
* Consolidated academic principles in 3NF database normalization, tiered architecture, and cryptographic session protection.

## 4.2 Professional Ethics, Teamwork, and Leadership
* Collaborated with supervisor **Ato Teha Mohammed** to translate industrial business requirements into software features.
* Demonstrated initiative by architecting the complete system, writing seeder scripts, and building administrative tools.

## 4.3 Student Self-Evaluation

```
+-------------------------------------------------------------------------------------------------------+
| TABLE 4.1: Comprehensive Student Self-Evaluation                                                      |
+------------------------------------+------------------------------------------------------------------+
| Evaluated Dimension                | Assessment & Reflection                                          |
+------------------------------------+------------------------------------------------------------------+
| Technical Agility (Strength)       | Rapidly mastered TanStack Start, React 19, and Aiven Cloud       |
|                                    | MySQL, delivering a production-grade application in 8 weeks.     |
+------------------------------------+------------------------------------------------------------------+
| Architectural Thinking (Strength)  | Designed a clean, secure 3-tier architecture with zero-trust     |
|                                    | server validation and tamper-proof session management.           |
+------------------------------------+------------------------------------------------------------------+
| Proactiveness (Strength)           | Independently structured product catalogs, seeded data, and      |
|                                    | implemented comprehensive administrative tooling.                |
+------------------------------------+------------------------------------------------------------------+
```

\newpage

---

# CHAPTER FIVE: CONCLUSION & RECOMMENDATIONS

## 5.1 Overall Conclusion
The summer practical attachment at Polar Fiber successfully connected classroom theory at Haramaya University with industrial software engineering practice, delivering a production-ready management platform for Polar Fiber.

## 5.2 Recommendations
* **For Polar Fiber**: Deploy the system on production cloud hosting, integrate Telebirr/CBE Birr payment gateways, and implement SMS alerts.
* **For Haramaya University**: Introduce modern TypeScript full-stack frameworks into the curriculum and consider extending practical attachment periods.

\newpage

---

# REFERENCES

1. **Polar Fiber Enterprise** (2026). *Corporate Profile, Product Catalog, and 10-Year Warranty Guide*. Addis Ababa, Ethiopia. URL: `https://polarfiber.com.et`.
2. **TanStack Start Documentation** (2026). *Full-Stack React Framework & Server Functions*. URL: `https://tanstack.com/start`.
3. **Oracle Corporation** (2024). *MySQL 8.0 Reference Manual: InnoDB Engine and Transactions*. Oracle Press.
4. **Aiven Cloud Documentation** (2026). *Managed MySQL Cloud Architecture & SSL/TLS Configuration*. URL: `https://aiven.io/docs/products/mysql`.
5. **Haramaya University** (2024). *Undergraduate Practical Attachment / Internship Guidelines*. College of Computing and Informatics.

---
**[END OF REPORT]**
