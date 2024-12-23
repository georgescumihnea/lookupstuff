export type Database = {
  users: {
    id: string
    email: string
    credits: number
    role: 'user' | 'admin'
  }
  searches: {
    id: string
    user_id: string
    category: 'category1' | 'category2' | 'category3' | 'category4'
    query: string
    status: 'pending' | 'completed'
    result?: string
    created_at: string
  }
  transactions: {
    id: string
    user_id: string
    amount: number
    credits: number
    status: 'pending' | 'completed' | 'failed'
    plisio_txn_id: string
    created_at: string
  }
}

