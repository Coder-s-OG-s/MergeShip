# MergeShip

MergeShip is a platform designed to streamline the open source contribution and maintenance experience. It provides specialized dashboards for both contributors and maintainers to better manage repositories, triage issues, track pull requests, and foster community engagement.

## Features

### Contributor Dashboard
- **Discovery**: Find tailored issues to work on based on skill set and interests.
- **Workflow Tracking**: Manage active pull requests and engaged issues.
- **Community & Mentorship**: Connect with mentors and track personal achievements.
- **Leaderboards**: Engage in gamified community leaderboards based on contribution metrics.

### Maintainer Command Center
- **Overview**: High-level repository health, urgent issues, and pull request metrics.
- **Team Workload**: Real-time team capacity and automated reassignment recommendations.
- **Issue Triage**: AI-powered issue categorization and duplicate detection to maintain a clean backlog.
- **Analytics**: Deep-dive metrics into merge velocity, closure rates, and contributor retention.

## Getting Started

Follow these instructions to set up the project on your local machine for development and testing.

### Prerequisites

Ensure you have the following installed on your system:
- Node.js (v18 or higher recommended)
- npm (Node Package Manager)

### Installation

1. Clone the repository to your local machine:
   ```bash
   git clone git@github.com:Coder-s-OG-s/MergeShip.git
   cd MergeShipProject
   ```

2. Install the project dependencies:
   ```bash
   npm install
   ```

### Running the Development Server

Start the local development server:

```bash
npm run dev
```

The application will be available at `http://localhost:3000`. 

### Project Structure

- `src/app`: Contains the Next.js application routes (App Router).
  - `(contributor)`: Routes specific to the contributor experience.
  - `(maintainer)`: Routes specific to the maintainer experience.
- `src/components`: Reusable React components.
- `src/data`: Mock data for development and testing.

## Contributing

We welcome contributions to improve MergeShip. Please review the project structure and ensure any changes align with the established design language and component architecture.
