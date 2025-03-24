import { google, calendar_v3 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import * as dotenv from 'dotenv';
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Set up OAuth2 client
const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

if (!clientId || !clientSecret || !refreshToken) {
  console.error('Missing Google Calendar API credentials in environment variables');
  console.error(`GOOGLE_CLIENT_ID: ${clientId ? 'Set' : 'Missing'}`);
  console.error(`GOOGLE_CLIENT_SECRET: ${clientSecret ? 'Set' : 'Missing'}`);
  console.error(`GOOGLE_REFRESH_TOKEN: ${refreshToken ? 'Set' : 'Missing'}`);
}

const oauth2Client = new OAuth2Client(clientId, clientSecret);

// Set refresh token
oauth2Client.setCredentials({
  refresh_token: refreshToken
});

// Create Google Calendar API client
const calendar = google.calendar({
  version: 'v3',
  auth: oauth2Client as any // Type assertion to bypass type mismatch between packages
});

// Tool to create a calendar event
export const createCalendarEventTool = createTool({
  id: "createCalendarEvent",
  description: "Create a new event in Google Calendar",
  inputSchema: z.object({
    summary: z.string().describe("Title of the event"),
    description: z.string().optional().describe("Description of the event"),
    location: z.string().optional().describe("Location of the event"),
    startDateTime: z.string().describe("Start date and time of the event in ISO format (YYYY-MM-DDTHH:MM:SS+09:00)"),
    endDateTime: z.string().describe("End date and time of the event in ISO format (YYYY-MM-DDTHH:MM:SS+09:00)"),
    attendees: z.array(z.string()).optional().describe("List of email addresses of attendees"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    eventId: z.string().optional(),
    eventLink: z.string().optional(),
    message: z.string().optional(),
    error: z.string().optional(),
  }),
  execute: async ({ context }) => {
    try {
      const event: calendar_v3.Schema$Event = {
        summary: context.summary,
        description: context.description,
        location: context.location,
        start: {
          dateTime: context.startDateTime,
          timeZone: 'Asia/Tokyo',
        },
        end: {
          dateTime: context.endDateTime,
          timeZone: 'Asia/Tokyo',
        },
      };

      // Add attendees if provided
      if (context.attendees && context.attendees.length > 0) {
        event.attendees = context.attendees.map((email: string) => ({ email }));
      }

      const response = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: event,
      });

      return {
        success: true,
        eventId: response.data.id || undefined,
        eventLink: response.data.htmlLink || undefined,
        message: 'Event created successfully'
      };
    } catch (error: any) {
      console.error('Error creating calendar event:', error);
      return {
        success: false,
        error: error.message || 'Failed to create calendar event'
      };
    }
  }
});

// Tool to get calendar events
export const getCalendarEventsTool = createTool({
  id: "getCalendarEvents",
  description: "Get events from Google Calendar",
  inputSchema: z.object({
    timeMin: z.string().describe("Start time to get events from in ISO format (YYYY-MM-DDTHH:MM:SS+09:00)"),
    timeMax: z.string().optional().describe("End time to get events until in ISO format (YYYY-MM-DDTHH:MM:SS+09:00)"),
    maxResults: z.number().optional().describe("Maximum number of events to return"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    events: z.array(
      z.object({
        id: z.string().optional(),
        summary: z.string().optional(),
        description: z.string().optional(),
        location: z.string().optional(),
        start: z.string().optional(),
        end: z.string().optional(),
        attendees: z.array(z.string()).optional(),
        link: z.string().optional(),
      })
    ).optional(),
    count: z.number().optional(),
    error: z.string().optional(),
  }),
  execute: async ({ context }) => {
    try {
      const response = await calendar.events.list({
        calendarId: 'primary',
        timeMin: context.timeMin,
        timeMax: context.timeMax,
        maxResults: context.maxResults || 10,
        singleEvents: true,
        orderBy: 'startTime',
      });

      const events = response.data.items || [];
      
      // Format events for better readability
      const formattedEvents = events.map(event => {
        const start = event.start?.dateTime || event.start?.date;
        const end = event.end?.dateTime || event.end?.date;
        
        return {
          id: event.id || undefined,
          summary: event.summary || undefined,
          description: event.description || undefined,
          location: event.location || undefined,
          start: start || undefined,
          end: end || undefined,
          attendees: event.attendees?.map(attendee => attendee.email || '') || undefined,
          link: event.htmlLink || undefined
        };
      });

      return {
        success: true,
        events: formattedEvents,
        count: formattedEvents.length
      };
    } catch (error: any) {
      console.error('Error getting calendar events:', error);
      return {
        success: false,
        error: error.message || 'Failed to get calendar events'
      };
    }
  }
});

// Tool to update a calendar event
export const updateCalendarEventTool = createTool({
  id: "updateCalendarEvent",
  description: "Update an existing event in Google Calendar",
  inputSchema: z.object({
    eventId: z.string().describe("ID of the event to update"),
    summary: z.string().optional().describe("New title of the event"),
    description: z.string().optional().describe("New description of the event"),
    location: z.string().optional().describe("New location of the event"),
    startDateTime: z.string().optional().describe("New start date and time of the event in ISO format (YYYY-MM-DDTHH:MM:SS+09:00)"),
    endDateTime: z.string().optional().describe("New end date and time of the event in ISO format (YYYY-MM-DDTHH:MM:SS+09:00)"),
    attendees: z.array(z.string()).optional().describe("New list of email addresses of attendees"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    eventId: z.string().optional(),
    eventLink: z.string().optional(),
    message: z.string().optional(),
    error: z.string().optional(),
  }),
  execute: async ({ context }) => {
    try {
      // First get the existing event
      const getResponse = await calendar.events.get({
        calendarId: 'primary',
        eventId: context.eventId
      });
      
      const existingEvent = getResponse.data;
      
      // Prepare update with only the fields that are provided
      const updatedEvent: calendar_v3.Schema$Event = {};
      
      if (context.summary !== undefined) updatedEvent.summary = context.summary;
      if (context.description !== undefined) updatedEvent.description = context.description;
      if (context.location !== undefined) updatedEvent.location = context.location;
      
      if (context.startDateTime !== undefined) {
        updatedEvent.start = {
          dateTime: context.startDateTime,
          timeZone: 'Asia/Tokyo'
        };
      }
      
      if (context.endDateTime !== undefined) {
        updatedEvent.end = {
          dateTime: context.endDateTime,
          timeZone: 'Asia/Tokyo'
        };
      }
      
      if (context.attendees !== undefined) {
        updatedEvent.attendees = context.attendees.map((email: string) => ({ email }));
      }
      
      // Update the event
      const updateResponse = await calendar.events.update({
        calendarId: 'primary',
        eventId: context.eventId,
        requestBody: updatedEvent
      });
      
      return {
        success: true,
        eventId: updateResponse.data.id || undefined,
        eventLink: updateResponse.data.htmlLink || undefined,
        message: 'Event updated successfully'
      };
    } catch (error: any) {
      console.error('Error updating calendar event:', error);
      return {
        success: false,
        error: error.message || 'Failed to update calendar event'
      };
    }
  }
});

// Tool to delete a calendar event
export const deleteCalendarEventTool = createTool({
  id: "deleteCalendarEvent",
  description: "Delete a calendar event by its ID",
  inputSchema: z.object({
    eventId: z.string().describe("The ID of the event to delete"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string().optional(),
    error: z.string().optional(),
  }),
  execute: async ({ context }) => {
    try {
      await calendar.events.delete({
        calendarId: 'primary',
        eventId: context.eventId
      });

      return {
        success: true,
        message: `Event with ID ${context.eventId} has been deleted successfully.`
      };
    } catch (error: any) {
      console.error('Error deleting calendar event:', error);
      return {
        success: false,
        error: error.message || 'Failed to delete calendar event'
      };
    }
  }
});
