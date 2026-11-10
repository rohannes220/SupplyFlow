# SupplyFlow Product Requirements Document

- **Course:** CS6983 - Project 2: Full-Stack Application
- **Project type:** Pair project
- **Team members:** Rohan Kumar and Partner (TBD)
- **Date:** October 24, 2026
- **Version:** 1.1

## 1. Project Overview
SupplyFlow is a full-stack web application designed to help companies manage supply chain operations through a centralized platform. Businesses often rely on spreadsheets, emails, and disconnected systems to manage vendors and purchase orders, making purchasing activity and deliveries difficult to track. The application provides employees one platform to manage vendors, create and modify purchase orders, track deliveries, and view supply chain metrics.

## 2. Project Objectives
The application will allow companies to:
- Add, edit, deactivate, and search vendors.
- Create, update, approve, and cancel purchase orders; assign orders to vendors.
- Track order progress from creation to delivery and monitor purchasing activity with an analytics dashboard.
- Securely access the application through authentication and role-based permissions.

## 3. Target Users
### Administrator
Administrators can add, edit, and deactivate vendors; view all purchase orders; approve pending purchase orders; update delivery statuses; and access the analytics dashboard.

### Employee
Employees can view and search vendors; create purchase orders; edit or cancel their own draft orders; submit orders for approval; and view order statuses and dashboard metrics.

The application will use two predefined demo accounts to simplify authentication testing.

## 4. Core Features and User Stories
### Feature 1: User Authentication
#### US-01: Secure Login
As an employee, I want to securely log in so that I can access the supply chain platform.

Acceptance criteria:
- Users log in with an email and password; the backend authenticates credentials and issues a JWT.
- Invalid credentials display an error; protected pages require authentication; users can log out.

#### US-02: Role-Based Access Control
As an administrator, I want users to have different permissions so that sensitive actions remain restricted.

Acceptance criteria:
- The system supports Admin and Employee roles.
- Only administrators can create or edit vendors and approve purchase orders.
- Employees can create and manage their own draft orders.
- Unauthorized API requests return HTTP 403; the frontend hides restricted controls.

### Feature 2: Vendor Management
#### US-03: Add Vendor
As an administrator, I want to add vendors so that employees can assign purchase orders to them.

Acceptance criteria: Administrators can open an Add Vendor form; users can enter vendor name, email, phone, and status; required fields are validated; vendor information is saved in PostgreSQL and appears in the vendor table.

#### US-04: Edit and Deactivate Vendors
As an administrator, I want to update vendor information so that vendor records remain accurate.

Acceptance criteria: Administrators can edit vendor details and deactivate vendors; inactive vendors cannot receive new purchase orders; existing purchase orders retain their vendor references.

#### US-05: Search and View Vendors
As an employee, I want to search vendors so that I can quickly find vendor information.

Acceptance criteria: Users can view a vendor table, search by name, filter by status, and view vendor details.

### Feature 3: Purchase Order Management
#### US-06: Create Purchase Orders
As an employee, I want to create purchase orders so that I can request products from vendors.

Acceptance criteria:
- Employees can select an active vendor, add products with quantities and prices, and select an expected delivery date.
- Order totals are calculated automatically; new orders are saved with Draft status.

#### US-07: Edit or Cancel Orders
As an employee, I want to modify orders so that I can correct purchasing requests.

Acceptance criteria: Employees can edit their own Draft orders, change quantities and prices, and recalculate totals; eligible orders can be canceled; Delivered orders cannot be modified.

#### US-08: Approve Purchase Orders
As an administrator, I want to approve purchase orders so that purchasing requests are reviewed.

Acceptance criteria: Employees can submit Draft orders for approval (Pending); administrators can approve Pending orders (Approved); employees cannot approve orders.

### Feature 4: Order Tracking
#### US-09: Track Purchase Orders
As an employee, I want to track orders so that I can monitor delivery progress.

Acceptance criteria: Users can view and filter order statuses; administrators can update approved orders to Shipped and Delivered; invalid transitions are rejected; changes appear without reloading the entire application.

### Feature 5: Analytics Dashboard
#### US-10: View Dashboard Metrics
As an employee or administrator, I want to view supply chain metrics so that I can monitor purchasing activity.

Acceptance criteria: The dashboard displays total orders, active vendors, pending orders, total order spending, and overdue deliveries; metrics refresh when relevant order or vendor data changes.

## 5. Application Screens
The four main screens are:
- **Login Page:** Email and password fields, login button, and error messages.
- **Dashboard:** Summary cards for total orders, active vendors, pending orders, total spending, and recent order activity.
- **Vendor Management:** Vendor table, search and filters, Add Vendor form, and Edit Vendor form.
- **Purchase Order Management:** Purchase order table, Create Order form, order details, and status controls.

UI/UX requirements: professional enterprise-style dashboard; consistent sidebar navigation; responsive layouts; accessible forms and buttons; clear validation and error messages; loading and empty states.

**Mockup references:** To be added after creating the initial designs in Claude Artifacts or Figma.

## 6. Technology Stack
| Component | Technology |
| --- | --- |
| Frontend | React + Tailwind CSS |
| Backend | Node.js + Express |
| Database | PostgreSQL |
| Authentication | JWT |
| API documentation | Swagger/OpenAPI |
| Unit testing | Vitest |
| Integration testing | Supertest |
| E2E testing | Playwright |
| CI/CD | GitHub Actions |
| Deployment | Vercel + Render |
| AI development | Antigravity + AGENTS.md |

## 7. Database Design
The application will use four primary tables:
- **Users:** `id` (Primary Key), `name`, `email`, `password_hash`, `role`.
- **Vendors:** `id` (Primary Key), `name`, `email`, `phone`, `status`.
- **Orders:** `id` (Primary Key), `vendor_id` (Foreign Key), `created_by` (Foreign Key), `status`, `expected_delivery_date`, `total_amount`.
- **Order_Items:** `id` (Primary Key), `order_id` (Foreign Key), `product_name`, `quantity`, `unit_price`.

Relationships: One vendor can have multiple orders; one user can create multiple orders; one order can contain multiple order items.

## 8. API Requirements
The backend will provide RESTful API endpoints:
| Method | Endpoint | Description |
| --- | --- | --- |
| POST | `/api/auth/login` | Authenticate user |
| GET | `/api/auth/me` | Retrieve current user |
| GET | `/api/vendors` | Retrieve vendors |
| POST | `/api/vendors` | Create vendor |
| PUT | `/api/vendors/:id` | Update vendor |
| GET | `/api/orders` | Retrieve orders |
| POST | `/api/orders` | Create order |
| PUT | `/api/orders/:id` | Update order |
| PATCH | `/api/orders/:id/status` | Update order status |
| GET | `/api/dashboard` | Retrieve dashboard metrics |

All endpoints will be documented using Swagger/OpenAPI.

## 9. Testing Strategy
The team will follow test-driven development using the red-green-refactor approach.
- **Unit testing:** Input validation, order total calculations, role permissions, and status transition logic.
- **Integration testing:** Authentication, vendor operations, purchase order operations, and database interactions.
- **End-to-end testing:** Login, vendor creation, purchase order creation, order approval, and dashboard updates.

Failing tests will be committed before implementation to demonstrate TDD.

## 10. Agile Development Plan
### Sprint 1 - October 24-31
Configure React, Express, and PostgreSQL; implement JWT authentication and Admin/Employee roles; build vendor management and purchase order creation; create initial unit and integration tests.

### Sprint 2 - November 1-12
Complete purchase order management; implement approval and order tracking; build the analytics dashboard; add E2E tests; configure CI/CD and security scanning; deploy the application; complete documentation and demo video.

Both partners will contribute code, review pull requests, participate in standups, and document sprint retrospectives.

## 11. AI-Assisted Development
The team will use Antigravity as its primary AI coding environment. The shared `AGENTS.md` file will document the technology stack and architecture, coding conventions, naming standards, testing requirements, PRD and mockup references, GitHub branch and pull request workflow, and security and accessibility practices. The team will review and test AI-generated code before merging it.

## 12. CI/CD and Deployment
GitHub Actions will run linting, automated tests, and security checks on pull requests. The application will use deployment previews and automated production deployment. Environment variables will manage sensitive credentials.

## 13. Out of Scope
The initial application will not include AI demand forecasting, payment processing, external ERP integrations, warehouse management, GPS shipment tracking, or automated vendor email notifications.

## 14. Expected Deliverables
Deployed full-stack application; GitHub repository with contributions from both partners; two Agile sprints and GitHub Project board; shared AGENTS.md rules file; automated tests and CI/CD; API documentation; architecture and database diagrams; README and deployment guide; 10-minute demo video; partner contribution log; individual reflections.

## 15. Conclusion
SupplyFlow will provide a centralized system for managing vendors, purchase orders, and delivery activity. The project will demonstrate how full-stack development, database integration, authentication, automated testing, and AI-assisted engineering can be combined to create a practical business application.
