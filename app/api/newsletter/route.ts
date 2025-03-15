import { NextResponse } from 'next/server'
import { z } from 'zod'

// Email validation schema
const newsletterSchema = z.object({
  email: z.string().email('Invalid email address'),
})

export async function POST(request: Request) {
  try {
    // Parse the request body
    const body = await request.json()
    
    // Validate the email
    const { email } = newsletterSchema.parse(body)

    // Here you would typically:
    // 1. Add the email to your newsletter service (e.g., Mailchimp, ConvertKit)
    // 2. Save to your database if needed
    
    // For now, we'll just return a success response
    return NextResponse.json(
      { message: 'Successfully subscribed to newsletter' },
      { status: 200 }
    )
  } catch (error) {
    // If it's a validation error
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      )
    }

    // For any other errors
    console.error('Newsletter subscription error:', error)
    return NextResponse.json(
      { error: 'Failed to subscribe to newsletter' },
      { status: 500 }
    )
  }
} 