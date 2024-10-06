[![Review Assignment Due Date](https://classroom.github.com/assets/deadline-readme-button-24ddc0f5d75046c5622901739e7c5dd533143b0c8e959d652212380cedb1ea36.svg)](https://classroom.github.com/a/MhkFIDKy)

## Description

This project is part of an assignment for [provide a brief description here].

## Installation

To install and run this project locally, follow these steps:

1. Clone the repository: `git clone [repository URL]`
2. Navigate to the project directory: `cd assignment-01-krishnawanusha`
3. Install dependencies: `npm install`
4. Set up environment variables: Create a `.env` and fill in the necessary values.
5. Run the development server: `npm run dev`

## env

PORT
MONGO_URI
ACCESS_TOKEN_SECRET
REFRESH_TOKEN_SECRET
EMAIL_ADDRESS
EMAIL_PASSWORD

## Usage

- After installing the project, you can start using it locally.
- Here are the available routes and functionalities:

### Authentication Routes

- `/auth/signup`: Sign up for a new account.
- `/auth/login`: Log in to an existing account.
- `/auth/refresh-token`: Refresh authentication token.

### Course Routes

- `/course`: List all courses.
- `/course/:id`: Get details of a specific course.
- `/course/enroll/self/:code`: Enroll in a course.
- `/course/enrolled-list/:code`: Get enrolled students list for a course.
- `/course/enroll/add-student`: Add a student to a course.
- `/course/enroll/remove-student`: Remove a student from a course.

### Location Routes

- `/location`: Create a new location.

### Timetable Routes

- `/timetable`: Create a new timetable session.
- `/timetable/student-timetable`: View timetable for a student.
- `/timetable/:id`: Update or delete a timetable session.
- `/timetable/update/change-time-slot`: Change time slot for a session.
- `/timetable/update/change-location`: Change location for a session.

## Testing

To run the tests, use the following command:

```bash
npm test
```
