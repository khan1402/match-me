# Match-Me Golang Backend: Architecture & Compliance Plan

**Author**: Manus AI
**Date**: Dec 23, 2025

## 1. Introduction

This document outlines the architecture and implementation plan for converting the Match-Me backend from Node.js to Golang. The primary objective is to achieve **100% compliance** with all mandatory functional requirements and testing criteria provided.

## 2. Core Technology Stack

The backend will be built using the following technologies:

| Category             | Technology                               | Rationale                                                                |
| -------------------- | ---------------------------------------- | ------------------------------------------------------------------------ |
| **Web Framework**      | [Gin](https://gin-gonic.com/)            | Lightweight, high-performance, and has a similar API to Express.         |
| **Database Driver**    | [pgx](https://github.com/jackc/pgx)      | High-performance and feature-rich PostgreSQL driver for Go.              |
| **Database Migrations**| [golang-migrate](https://github.com/golang-migrate/migrate) | A popular and robust tool for managing database schema migrations.       |
| **Real-time**        | [Gorilla WebSocket](https://github.com/gorilla/websocket) | A widely-used and stable WebSocket implementation for Go.                |
| **Authentication**   | [golang-jwt](https://github.com/golang-jwt/jwt) | Standard library for creating and verifying JWTs.                        |
| **Password Hashing** | `golang.org/x/crypto/bcrypt`             | The official and secure way to handle password hashing in Go.            |
| **Environment Vars** | [godotenv](https://github.com/joho/godotenv) | For loading environment variables from a `.env` file during development. |

## 3. Project Structure

The project will be organized as follows to ensure a clean separation of concerns:

```
/home/ubuntu/match-me-go/
├── cmd/                  # Main application entry point
│   └── server/
│       └── main.go
├── db/                   # Database connection, queries, and migrations
│   ├── migrations/         # SQL migration files
│   ├── connection.go
│   ├── users.go
│   ├── profiles.go
│   └── ... (other query files)
├── handlers/             # HTTP request handlers (controllers)
│   ├── auth.go
│   ├── users.go
│   └── ... (other handler files)
├── middleware/           # Gin middleware (e.g., authentication)
│   └── auth.go
├── models/               # Go structs representing database tables and API responses
│   └── models.go
├── socket/               # WebSocket implementation for real-time features
│   └── hub.go
├── utils/                # Utility functions (e.g., JWT, password hashing)
│   └── auth.go
├── go.mod                # Go module definition
├── go.sum                # Go module checksums
├── .env.example          # Example environment variables
└── Dockerfile            # For containerization
```

## 4. API Endpoint Implementation

All RESTful endpoints specified in the requirements will be implemented. The routing will be handled by Gin.

| Method | Path                       | Handler Function        | Middleware         | Description                                               |
| ------ | -------------------------- | ----------------------- | ------------------ | --------------------------------------------------------- |
| POST   | /api/auth/register         | `handlers.Register`     | -                  | Register a new user.                                      |
| POST   | /api/auth/login            | `handlers.Login`        | -                  | Log in a user and return a JWT.                           |
| POST   | /api/auth/logout           | `handlers.Logout`       | -                  | Clear the authentication cookie.                          |
| GET    | /api/me                    | `handlers.GetMe`        | `middleware.Auth`  | Get the authenticated user's basic info.                  |
| GET    | /api/me/profile            | `handlers.GetMyProfile` | `middleware.Auth`  | Get the authenticated user's full profile.                |
| GET    | /api/me/bio                | `handlers.GetMyBio`     | `middleware.Auth`  | Get the authenticated user's biographical data.           |
| GET    | /api/users/:id             | `handlers.GetUser`      | `middleware.OptAuth`| Get a user's name and profile picture.                    |
| GET    | /api/users/:id/profile     | `handlers.GetUserProfile`| `middleware.OptAuth`| Get a user's "about me" information.                      |
| GET    | /api/users/:id/bio         | `handlers.GetUserBio`   | `middleware.OptAuth`| Get a user's biographical data for recommendations.       |
| GET    | /api/users/:id/discovery   | `handlers.GetUserDiscovery`| `middleware.OptAuth`| Get a user's full profile for the discovery feed.         |
| GET    | /api/recommendations       | `handlers.GetRecommendations`| `middleware.Auth`  | Get a list of recommended user IDs.                       |
| GET    | /api/connections           | `handlers.GetConnections`| `middleware.Auth`  | Get a list of connected user IDs.                         |
| POST   | /api/interactions          | `handlers.CreateInteraction`| `middleware.Auth`  | Create an interaction (like/pass) with another user.      |
| GET    | /api/matches/:matchId/messages | `handlers.GetMessages` | `middleware.Auth`  | Get chat messages for a match (with pagination).          |
| POST   | /api/matches/:matchId/messages | `handlers.SendMessage` | `middleware.Auth`  | Send a chat message.                                      |

## 5. Database and Migrations

- **Schema**: The existing PostgreSQL schema will be replicated. The `drizzle/schema.ts` file will be used as the source of truth.
- **Migrations**: `golang-migrate` will be used to create SQL migration files. An initial migration will be created to set up the entire schema. This ensures the database is identical to the Node.js version.
- **Seeding**: A Go script will be created to populate the database with a minimum of 100 fictitious users, as required for testing.

## 6. Real-Time Features

Real-time functionality will be implemented using Gorilla WebSocket to meet the "no polling" requirement.

- **Hub**: A central hub (`socket/hub.go`) will manage WebSocket connections, mapping user IDs to their connections.
- **Events**:
    - **`message`**: When a user sends a message via the REST API, the handler will also push the message to the recipient through the WebSocket hub.
    - **`typing`**: A new WebSocket endpoint will handle `typing_start` and `typing_stop` events.
    - **`online_status`**: The `lastSignedIn` timestamp in the `users` table will be updated on every authenticated API request and WebSocket connection. This will be used to determine online status.

## 7. Compliance Checklist

This table explicitly maps each mandatory testing criterion to its planned implementation.

| #   | Requirement                                                     | Implementation Plan                                                                                                                                                           |
| --- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Register with email and password.                               | `handlers.Register` will use `bcrypt` to hash the password and store the new user in the `users` table.                                                                     |
| 2   | User can log out.                                               | `handlers.Logout` will clear the `auth_token` cookie.                                                                                                                         |
| 3   | Refuses to recommend an obviously poor match.                   | The recommendation algorithm in `db/recommendations.go` will implement the `MIN_SCORE = 50` threshold.                                                                        |
| 4   | No recommendations until profile is complete.                   | `handlers.GetRecommendations` will check the `isProfileComplete` flag in the `profiles` table before returning any recommendations.                                               |
| 5   | Minimum of 5 biographical points to configure.                  | The frontend handles this, but the backend will provide the necessary fields in the `profiles` table (age, gender, location, bio, interests).                                |
| 6   | Profile picture can be set, removed, or changed.                | Handlers will be created to manage the `photos` table.                                                                                                                        |
| 7   | Email address is not shown, except to the owner.                | All user-related API responses for other users will not include the `email` field. This is enforced in the `models` and `handlers`.                                            |
| 8   | User can specify a location or preferred distance for matches.  | The `profiles` table includes `location` and `maxDistanceKm` fields, which will be updatable via a profile update endpoint.                                                   |
| 9   | User only sees recommendations from their location.             | The recommendation logic will be updated to strictly filter by location if specified. The previous implementation had a bug here, which will be fixed.                       |
| 10  | List of no more than 10 recommendations at a time.              | `handlers.GetRecommendations` will limit the final list of user IDs to 10.                                                                                                    |
| 11  | Recommendations are prioritized with the best first.            | The recommendation scores will be sorted in descending order.                                                                                                                 |
| 12  | Dismiss a recommendation (not shown again).                     | A `pass` interaction will be recorded. The recommendation query will exclude users with a `pass` interaction.                                                               |
| 13  | Connection requests can be sent, accepted, and rejected.        | The `interactions` table will be used to manage connection requests. A `like` creates a request. A mutual `like` creates a `match`.                                         |
| 14  | Chat is only possible between connected profiles.               | The `handlers.SendMessage` and `handlers.GetMessages` will verify that a `match` exists between the two users.                                                              |
| 15  | Chat works in real time (no polling).                           | Implemented using Gorilla WebSocket as described in Section 6.                                                                                                                |
| 16  | Unread message icon appears.                                    | A `notifications` table will be used. When a message is sent, a notification will be created for the recipient. The frontend will poll a `/notifications` endpoint.         |
| 17  | `/recommendations` and `/connections` endpoints return only IDs.| The handlers will be implemented to return `[]int`.                                                                                                                           |
| 18  | `/users`, `/profile`, `/bio` endpoints return specified data.   | The handlers will return the exact response structures defined in `models/models.go`.                                                                                         |
| 19  | `/users` endpoints return HTTP 404 when not found or not allowed.| The handlers will check for permissions and return `http.StatusNotFound` to prevent leaking information.                                                                    |
| 20  | Backend is implemented in Go.                                   | This entire plan is for a Golang implementation.                                                                                                                              |
| 21  | A PostgreSQL database is used.                                  | The project will use the `pgx` driver for PostgreSQL.                                                                                                                         |
| 22  | Application is secure (message access control).                 | The `GetMessages` and `SendMessage` handlers will verify that the authenticated user is part of the `matchId` before proceeding. This fixes the security flaw in the original. |
| 23  | Method to load 100+ fictitious users.                           | A Go script will be created in the `scripts` directory.                                                                                                                       |
| 24  | Online/offline indicator is shown.                              | The `lastSignedIn` timestamp will be used. A user will be considered online if their `lastSignedIn` is within the last 5 minutes.                                            |
| 25  | Typing in progress indicator is shown.                          | A WebSocket event will be implemented for this.                                                                                                                               |
| 26  | Proximity-based location filtering.                             | The recommendation logic will use the Haversine formula to calculate distances between GPS coordinates if available.                                                        |

This plan provides a comprehensive roadmap for a successful and compliant backend conversion. I will now proceed with the implementation.
