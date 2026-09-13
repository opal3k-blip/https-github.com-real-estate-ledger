# ERD — نموذج بيانات Firestore

```mermaid
erDiagram
  OPPORTUNITIES ||--o{ UNDERWRITING_VERSIONS : has
  OPPORTUNITIES ||--o{ ASSET_ACTUALS : has
  OPPORTUNITIES ||--o{ IC_DECISIONS : has
  OPPORTUNITIES ||--o{ OPP_AUDIT_LOG : audited_by
  OPPORTUNITIES }o--o{ FUNDS : linked_asset

  FUNDS ||--o{ COMMITMENTS : receives
  INVESTORS ||--o{ COMMITMENTS : makes
  FUNDS ||--o{ CAPITAL_CALLS : issues
  INVESTORS ||--o{ CAPITAL_CALLS : pays
  FUNDS ||--o{ DISTRIBUTIONS : pays
  INVESTORS ||--o{ DISTRIBUTIONS : receives
  FUNDS ||--o{ TRANSACTIONS : records
  INVESTORS ||--o{ TRANSACTIONS : records

  TEAM_MEMBERS ||--o| TEAM_ROLES : assigned
  MONDAY_CONFIG ||--o{ MONDAY_TASK_QUEUE : configures
  OPPORTUNITIES ||--o{ MONDAY_TASK_QUEUE : creates_tasks

  OPPORTUNITIES {
    string id
    map meta
    map land
    map income
    map development
    map financing
    map ic
    map capitalAllocation
  }
  UNDERWRITING_VERSIONS {
    string id
    string oppId
    string stage
    string trigger
    string sourceDecisionId
    string savedBy
    timestamp savedAt
    map metrics
  }
  ASSET_ACTUALS {
    string id
    string oppId
    string period
    date asOfDate
    string enteredBy
    number actualEquityIRR
    number actualMOIC
    number actualDSCR
  }
  IC_DECISIONS {
    string id
    string oppId
    string recordedBy
    timestamp recordedAt
    map decision
  }
  FUNDS {
    string id
    string name
    number targetSize
    array assetIds
  }
  INVESTORS {
    string id
    string name
    string email
  }
  COMMITMENTS {
    string id
    string fundId
    string investorId
    number amount
    string reversalOfId
  }
  CAPITAL_CALLS {
    string id
    string fundId
    string investorId
    number amount
    string status
  }
  DISTRIBUTIONS {
    string id
    string fundId
    string investorId
    number amount
    string status
  }
  TRANSACTIONS {
    string id
    string fundId
    string investorId
    string type
    number amount
  }
```

## ملاحظات Firestore

Firestore ليس قاعدة علائقية؛ العلاقات أعلاه منطقية عبر IDs داخل المستندات. لا توجد foreign keys تلقائية، لذلك تُفرض النزاهة الحرجة داخل `firestore.rules` أو Cloud Functions عند الحاجة.
