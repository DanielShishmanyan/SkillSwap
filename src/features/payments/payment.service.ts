export interface PaymentRequest { lessonId: string; amount: number; currency: 'EUR' }
export interface PaymentResult { transactionId: string; status: 'paid'; paidAt: string }

export interface PaymentProvider { pay(request: PaymentRequest): Promise<PaymentResult> }

class MockPaymentProvider implements PaymentProvider {
  async pay(request: PaymentRequest): Promise<PaymentResult> {
    await new Promise((resolve) => setTimeout(resolve, 700))
    return { transactionId: `mock_${request.lessonId}_${Date.now()}`, status: 'paid', paidAt: new Date().toISOString() }
  }
}

export const paymentService: PaymentProvider = new MockPaymentProvider()
