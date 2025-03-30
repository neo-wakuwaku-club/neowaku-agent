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

// Helper function to get calendar ID from name
async function getCalendarIdFromName(calendarName: string): Promise<string | null> {
  try {
    const response = await calendar.calendarList.list();
    const calendars = response.data.items || [];
    
    // Find calendar by name (case insensitive)
    const matchedCalendar = calendars.find(
      cal => cal.summary && cal.summary.toLowerCase() === calendarName.toLowerCase()
    );
    
    return matchedCalendar?.id || null;
  } catch (error) {
    console.error('Error finding calendar by name:', error);
    return null;
  }
}

// Tool to list available calendars
export const listCalendarsTool = createTool({
  id: "listCalendars",
  description: "List all available Google Calendars",
  inputSchema: z.object({}),
  outputSchema: z.object({
    success: z.boolean(),
    calendars: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        description: z.string().optional(),
        primary: z.boolean().optional(),
        accessRole: z.string().optional(),
      })
    ).optional(),
    error: z.string().optional(),
  }),
  execute: async ({ context }) => {
    try {
      const response = await calendar.calendarList.list();
      const calendars = response.data.items || [];
      
      const formattedCalendars = calendars.map(cal => ({
        id: cal.id || '',
        name: cal.summary || '',
        description: cal.description || undefined,
        primary: cal.primary || undefined,
        accessRole: cal.accessRole || undefined,
      }));
      
      return {
        success: true,
        calendars: formattedCalendars,
      };
    } catch (error: any) {
      console.error('Error listing calendars:', error);
      return {
        success: false,
        error: error.message || 'Failed to list calendars'
      };
    }
  }
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
    isAllDay: z.boolean().optional().describe("Whether the event is an all-day event"),
    visibility: z.enum(['default', 'public', 'private']).optional().describe("Visibility of the event: default, public, or private"),
    addGoogleMeet: z.boolean().optional().describe("Whether to add Google Meet conferencing to the event"),
    calendarId: z.string().optional().describe("ID of the calendar to create the event in. Defaults to 'primary'"),
    calendarName: z.string().optional().describe("Name of the calendar to create the event in. If provided, this will be used to find the calendar ID"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    eventId: z.string().optional(),
    eventLink: z.string().optional(),
    meetLink: z.string().optional(),
    message: z.string().optional(),
    error: z.string().optional(),
  }),
  execute: async ({ context }) => {
    try {
      // Resolve calendar ID from name if provided
      let targetCalendarId = context.calendarId || 'primary';
      if (context.calendarName) {
        const resolvedId = await getCalendarIdFromName(context.calendarName);
        if (resolvedId) {
          targetCalendarId = resolvedId;
        } else {
          console.warn(`Calendar with name "${context.calendarName}" not found, using ${targetCalendarId} instead.`);
        }
      }

      const event: calendar_v3.Schema$Event = {
        summary: context.summary,
        description: context.description,
        location: context.location,
      };

      // Set visibility if provided
      if (context.visibility) {
        event.visibility = context.visibility;
      }

      // Add Google Meet conferencing if requested
      if (context.addGoogleMeet) {
        event.conferenceData = {
          createRequest: {
            requestId: `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
            conferenceSolutionKey: {
              type: 'hangoutsMeet'
            }
          }
        };
      }

      // Handle all-day events differently than timed events
      if (context.isAllDay) {
        // For all-day events, use date instead of dateTime
        // Convert ISO string to YYYY-MM-DD format for all-day events
        const startDate = context.startDateTime.split('T')[0];
        let endDate = context.endDateTime.split('T')[0];
        
        // For all-day events, Google Calendar expects the end date to be the next day
        // This is because the end date is exclusive in all-day events
        const endDateObj = new Date(endDate);
        endDateObj.setDate(endDateObj.getDate() + 1);
        endDate = endDateObj.toISOString().split('T')[0];
        
        event.start = {
          date: startDate,
          timeZone: 'Asia/Tokyo',
        };
        event.end = {
          date: endDate,
          timeZone: 'Asia/Tokyo',
        };
      } else {
        // Regular timed event
        event.start = {
          dateTime: context.startDateTime,
          timeZone: 'Asia/Tokyo',
        };
        event.end = {
          dateTime: context.endDateTime,
          timeZone: 'Asia/Tokyo',
        };
      }

      // Add attendees if provided
      if (context.attendees && context.attendees.length > 0) {
        event.attendees = context.attendees.map((email: string) => ({ email }));
      }

      const response = await calendar.events.insert({
        calendarId: targetCalendarId,
        requestBody: event,
        conferenceDataVersion: context.addGoogleMeet ? 1 : 0,
      });

      return {
        success: true,
        eventId: response.data.id || undefined,
        eventLink: response.data.htmlLink || undefined,
        meetLink: response.data.conferenceData?.entryPoints?.[0]?.uri || undefined,
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
    calendarId: z.string().optional().describe("ID of the calendar to get events from. Defaults to 'primary'"),
    calendarName: z.string().optional().describe("Name of the calendar to get events from. If provided, this will be used to find the calendar ID"),
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
      // Resolve calendar ID from name if provided
      let targetCalendarId = context.calendarId || 'primary';
      if (context.calendarName) {
        const resolvedId = await getCalendarIdFromName(context.calendarName);
        if (resolvedId) {
          targetCalendarId = resolvedId;
        } else {
          console.warn(`Calendar with name "${context.calendarName}" not found, using ${targetCalendarId} instead.`);
        }
      }

      const response = await calendar.events.list({
        calendarId: targetCalendarId,
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
    isAllDay: z.boolean().optional().describe("Whether the event is an all-day event"),
    visibility: z.enum(['default', 'public', 'private']).optional().describe("Visibility of the event: default, public, or private"),
    calendarId: z.string().optional().describe("ID of the calendar containing the event. Defaults to 'primary'"),
    calendarName: z.string().optional().describe("Name of the calendar containing the event. If provided, this will be used to find the calendar ID"),
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
      // Resolve calendar ID from name if provided
      let targetCalendarId = context.calendarId || 'primary';
      if (context.calendarName) {
        const resolvedId = await getCalendarIdFromName(context.calendarName);
        if (resolvedId) {
          targetCalendarId = resolvedId;
        } else {
          console.warn(`Calendar with name "${context.calendarName}" not found, using ${targetCalendarId} instead.`);
        }
      }

      // First get the existing event
      const getResponse = await calendar.events.get({
        calendarId: targetCalendarId,
        eventId: context.eventId
      });
      
      const existingEvent = getResponse.data;
      
      // Create a copy of the existing event to update
      // This ensures we don't lose any fields when updating
      const updatedEvent: calendar_v3.Schema$Event = {
        ...existingEvent
      };
      
      // Update only the fields that are provided
      if (context.summary !== undefined) updatedEvent.summary = context.summary;
      if (context.description !== undefined) updatedEvent.description = context.description;
      if (context.location !== undefined) updatedEvent.location = context.location;
      if (context.visibility !== undefined) updatedEvent.visibility = context.visibility;
      
      // Handle date/time updates
      if (context.startDateTime !== undefined || context.endDateTime !== undefined || context.isAllDay !== undefined) {
        // Determine if this should be an all-day event
        const isAllDay = context.isAllDay !== undefined ? context.isAllDay : 
                         (existingEvent.start?.date !== undefined);
        
        if (isAllDay) {
          // For all-day events, use date instead of dateTime
          // Get the start date, either from the update or from the existing event
          let startDate = context.startDateTime ? context.startDateTime.split('T')[0] : 
                         (existingEvent.start?.date || existingEvent.start?.dateTime?.split('T')[0]);
          
          // Get the end date, either from the update or from the existing event
          let endDate = context.endDateTime ? context.endDateTime.split('T')[0] : 
                       (existingEvent.end?.date || existingEvent.end?.dateTime?.split('T')[0]);
          
          // For all-day events, Google Calendar expects the end date to be the next day
          // This is because the end date is exclusive in all-day events
          // Only adjust if we're converting from a timed event to an all-day event
          if (!existingEvent.start?.date && endDate) {
            const endDateObj = new Date(endDate);
            endDateObj.setDate(endDateObj.getDate() + 1);
            endDate = endDateObj.toISOString().split('T')[0];
          }
          
          // Make sure to create completely new objects for start and end
          // to avoid mixing date and dateTime properties
          updatedEvent.start = {
            date: startDate,
            timeZone: 'Asia/Tokyo',
          };
          updatedEvent.end = {
            date: endDate,
            timeZone: 'Asia/Tokyo',
          };
        } else {
          // Regular timed event - make sure both start and end are dateTime format
          const startDateTime = context.startDateTime || existingEvent.start?.dateTime;
          const endDateTime = context.endDateTime || existingEvent.end?.dateTime;
          
          // Create completely new objects to avoid mixing date and dateTime properties
          if (startDateTime) {
            updatedEvent.start = {
              dateTime: startDateTime,
              timeZone: 'Asia/Tokyo'
            };
          }
          
          if (endDateTime) {
            updatedEvent.end = {
              dateTime: endDateTime,
              timeZone: 'Asia/Tokyo'
            };
          }
        }
      }
      
      if (context.attendees !== undefined) {
        updatedEvent.attendees = context.attendees.map((email: string) => ({ email }));
      }
      
      // Update the event
      const updateResponse = await calendar.events.update({
        calendarId: targetCalendarId,
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
  description: "Delete an event from Google Calendar",
  inputSchema: z.object({
    eventId: z.string().describe("ID of the event to delete"),
    calendarId: z.string().optional().describe("ID of the calendar containing the event. Defaults to 'primary'"),
    calendarName: z.string().optional().describe("Name of the calendar containing the event. If provided, this will be used to find the calendar ID"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string().optional(),
    error: z.string().optional(),
  }),
  execute: async ({ context }) => {
    try {
      // Resolve calendar ID from name if provided
      let targetCalendarId = context.calendarId || 'primary';
      if (context.calendarName) {
        const resolvedId = await getCalendarIdFromName(context.calendarName);
        if (resolvedId) {
          targetCalendarId = resolvedId;
        } else {
          console.warn(`Calendar with name "${context.calendarName}" not found, using ${targetCalendarId} instead.`);
        }
      }

      await calendar.events.delete({
        calendarId: targetCalendarId,
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
