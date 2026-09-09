import { contradictionSamples } from './contradictionSamples.js'

export const defaultRequisition = {
  title: 'Junior Platform Engineer',
  team: 'Infrastructure · Bengaluru / Remote',
  description: 'Join a small platform team building reliable developer infrastructure. We value demonstrated learning and hands-on ownership over keyword-perfect resumes.',
  constraints: {
    minExperienceYears: 0,
    maxSalaryLpa: null,
    seniority: 'junior',
  },
  criteria: [
    {
      id: 'backend',
      name: 'Backend engineering',
      type: 'required',
      description: 'Hands-on work in Python, Go, Java, Node.js, or an equivalent server-side language.',
      aliases: ['python', 'golang', 'go ', 'java', 'node.js', 'nodejs', 'typescript backend', 'server-side', 'backend service', 'api development', 'microservice'],
    },
    {
      id: 'distributed',
      name: 'Distributed systems foundations',
      type: 'required',
      description: 'Practical experience with service communication, queues, consistency, or distributed workloads.',
      aliases: ['distributed system', 'microservice', 'service-oriented', 'event-driven', 'message queue', 'kafka', 'rabbitmq', 'sqs', 'pub/sub', 'concurrency', 'consensus', 'replication'],
    },
    {
      id: 'cloud',
      name: 'Cloud deployment',
      type: 'required',
      description: 'Has deployed and operated an application on AWS, GCP, Azure, or an equivalent cloud platform.',
      aliases: ['aws', 'amazon web services', 'gcp', 'google cloud', 'azure', 'cloud run', 'ec2', 'lambda', 'ecs', 'eks', 'kubernetes', 'k8s', 'docker', 'containerized', 'heroku', 'render.com'],
    },
    {
      id: 'reliability',
      name: 'Reliability & observability',
      type: 'required',
      description: 'Uses logs, metrics, tracing, alerting, testing, or incident practices to improve reliability.',
      aliases: ['observability', 'monitoring', 'metrics', 'logging', 'tracing', 'opentelemetry', 'prometheus', 'grafana', 'datadog', 'new relic', 'sentry', 'alerting', 'incident', 'slo', 'uptime', 'reliability'],
    },
    {
      id: 'multiregion',
      name: 'Multi-region failover ownership',
      type: 'required',
      description: 'Led production multi-region failover for a system serving at least 10k requests per second.',
      aliases: ['multi-region', 'multiregion', 'cross-region', 'regional failover', 'active-active', 'disaster recovery', '10k rps', '10000 requests'],
      stretch: true,
    },
    {
      id: 'iac',
      name: 'Infrastructure as code',
      type: 'preferred',
      description: 'Experience with Terraform, Pulumi, CloudFormation, Ansible, or equivalent tooling.',
      aliases: ['terraform', 'pulumi', 'cloudformation', 'infrastructure as code', 'iac', 'ansible'],
    },
    {
      id: 'collaboration',
      name: 'Cross-functional collaboration',
      type: 'preferred',
      description: 'Evidence of documentation, mentoring, stakeholder work, or team delivery.',
      aliases: ['cross-functional', 'stakeholder', 'mentored', 'mentoring', 'documentation', 'runbook', 'partnered', 'collaborated', 'code review', 'knowledge sharing'],
    },
  ],
}

export const sampleCandidates = [
  ...contradictionSamples,
  {
    id: 'A-01', name: 'Maya Rao', role: 'Backend Engineer', source: 'Referral',
    text: `Maya Rao\nBackend Engineer — 2 years experience\n\nSUMMARY\nBackend engineer focused on dependable services and practical operations.\n\nEXPERIENCE\nAssociate Engineer, Northstar Labs (2024–Present)\n• Built three Go microservices processing 1.8M shipment events per day through Kafka; added idempotency keys that cut duplicate processing by 92%.\n• Containerized services with Docker and deployed to AWS ECS using GitHub Actions.\n• Added Prometheus metrics, Grafana dashboards and paging alerts; reduced mean time to detect failures from 28 to 9 minutes.\n• Wrote incident runbooks and partnered with support during two production incidents.\n\nPROJECTS\nCreated a Terraform module for repeatable staging environments, reviewed by the platform team.\n\nCOVER NOTE\nI have not owned a multi-region system. I did shadow a disaster-recovery test and want to grow in this area.`,
  },
  {
    id: 'A-02', name: 'Arjun Mehta', role: 'Software Developer', source: 'Careers page',
    text: `Arjun Mehta\nSoftware Developer\n\nPROFILE\nExpert in distributed systems, Kubernetes, cloud architecture and site reliability. World-class problem solver.\n\nEDUCATION\nB.Tech Computer Science, 2025\nCoursework: Distributed Systems, Databases, Operating Systems.\n\nPROJECT\nBuilt a college attendance web application with React and Firebase.\n\nSKILLS\nPython, Java, AWS, Kubernetes, Terraform, Kafka, Prometheus.\n\nCOVER NOTE\nI am a fast learner and confident I can handle any scale.`,
  },
  {
    id: 'A-03', name: 'Noor Khan', role: 'Data Platform Associate', source: 'LinkedIn',
    text: `Noor Khan\nData Platform Associate — 18 months\n\nEXPERIENCE\n• Developed Python ingestion workers and REST APIs for a retail analytics platform.\n• Replaced nightly batch handoffs with an event-driven pipeline on Google Pub/Sub; processing latency fell from 6 hours to 18 minutes.\n• Shipped services as containers to Google Cloud Run and configured structured logs, uptime checks and Sentry alerts.\n• Authored onboarding documentation used by six analysts and two engineers.\n\nPROJECT\nUsed Pulumi to define a personal GCP environment.\n\nCOVER NOTE\nMy title says data, but most of my work has been backend service ownership. I have no multi-region production experience.`,
  },
  {
    id: 'A-04', name: 'Dev Shah', role: 'Site Reliability Intern', source: 'University',
    text: `Dev Shah\nSite Reliability Engineering Intern\n\nEXPERIENCE\nSix-month internship, Paperkite\n• Created Python automation that checked 240 service endpoints and opened actionable tickets.\n• Built Datadog dashboards and tuned alerts, reducing noisy pages by 31%.\n• Participated in incident reviews and updated 12 runbooks.\n• Assisted with Kubernetes deployments on Azure AKS; did not own releases independently.\n\nPROJECTS\nImplemented a toy distributed key-value store in Java using leader election and replication; tested node failure recovery locally.\n\nCOVER NOTE\nLooking for my first full-time role.`,
  },
  {
    id: 'A-05', name: 'Isha Bose', role: 'Full-stack Developer', source: 'Agency',
    text: `Isha Bose\nFull-stack Developer — 3 years\n\nEXPERIENCE\n• Built Node.js APIs and React interfaces for a B2B procurement product used by 4,000 monthly users.\n• Broke a monolith into independently deployed services communicating through RabbitMQ.\n• Led Docker-based deployments to AWS EC2 and introduced CloudWatch logging and Sentry error tracking.\n• Improved API p95 latency from 820ms to 290ms through caching and query changes.\n• Collaborated with product and customer success on quarterly releases.\n\nSKILLS\nNode.js, PostgreSQL, RabbitMQ, AWS, Docker, CloudWatch.\n\nCOVER NOTE\nI have read about Terraform but have not used it. No multi-region ownership.`,
  },
  {
    id: 'A-06', name: 'Ravi Kulkarni', role: 'Cloud Support Engineer', source: 'Referral',
    text: `Ravi Kulkarni\nCloud Support Engineer — 2 years\n\nEXPERIENCE\n• Triaged AWS networking and EC2 incidents for enterprise customers against response-time SLAs.\n• Created Bash and Python scripts that collected logs across instances, saving about 20 minutes per case.\n• Built CloudWatch dashboards and documented common failure modes.\n• Partnered with engineering on root-cause analysis for regional service events.\n\nCERTIFICATIONS\nAWS Solutions Architect Associate.\n\nCOVER NOTE\nStrong cloud operations background; I have not built production backend services or owned deployments.`,
  },
  {
    id: 'A-07', name: 'Leena Thomas', role: 'Graduate Engineer', source: 'Careers page',
    text: `Leena Thomas\nGraduate Software Engineer\n\nCLAIM\nExpert in distributed systems and highly scalable architecture.\n\nEDUCATION\nB.E. Information Technology, 2025\nRelevant course: Distributed Computing (grade A).\n\nPROJECTS\n• Built a Python FastAPI expense tracker used by five classmates; deployed it to Render.com.\n• Added automated tests and Sentry error reporting.\n\nSKILLS\nPython, FastAPI, Docker, Kubernetes, Kafka, AWS.\n\nCOVER NOTE\nThe distributed systems course was my favorite and I am eager to apply it professionally.`,
  },
  {
    id: 'A-08', name: 'Kabir Sen', role: 'Platform Engineer', source: 'LinkedIn',
    text: `Kabir Sen\nPlatform Engineer — 4 years\n\nEXPERIENCE\n• Operated Java services on Kubernetes across AWS regions; delivered automated regional disaster-recovery drills with a 14-minute recovery time.\n• Wrote Terraform for EKS clusters and shared networking modules.\n• Introduced OpenTelemetry tracing and service-level objectives for 22 services, improving incident diagnosis.\n• Supported Kafka clusters handling 7,500 messages per second and coached four service teams on safe consumers.\n• Facilitated incident reviews and maintained platform documentation.\n\nCOVER NOTE\nI have strong platform depth, though my experience exceeds the stated junior range. Traffic peaked below 10k requests per second and I supported rather than led the architecture.`,
  },
  {
    id: 'A-09', name: 'Sana Mir', role: 'QA Automation Engineer', source: 'Internal',
    text: `Sana Mir\nQA Automation Engineer — 2 years\n\nEXPERIENCE\n• Built a Java test service that generated concurrent workloads for twelve internal APIs.\n• Added distributed tracing assertions and Grafana quality dashboards to release pipelines.\n• Ran containerized test suites in Azure DevOps; partnered with backend teams to diagnose race conditions.\n• Documented release gates and mentored two interns in API testing.\n\nPROJECT\nDeployed a small Spring Boot service to Azure App Service.\n\nCOVER NOTE\nI am moving from quality engineering into platform work. I have not operated a customer-facing service.`,
  },
  {
    id: 'A-10', name: 'Vikram Gill', role: 'Software Engineer', source: 'Agency',
    text: `Vikram Gill\nSoftware Engineer — 2.5 years\n\nEXPERIENCE\n• Developed Python and TypeScript backend services for payment reconciliation.\n• Implemented SQS queues and retry policies for asynchronous settlement jobs, reducing failed jobs by 44%.\n• Deployed Lambda and ECS workloads through CloudFormation and GitHub Actions.\n• Added structured logging, CloudWatch metrics and on-call alerts; resolved three production incidents.\n• Wrote architecture decision records and reviewed teammates' changes.\n\nCOVER NOTE\nI have only worked in one AWS region.`,
  },
  {
    id: 'A-11', name: 'Ananya Iyer', role: 'Research Assistant', source: 'University',
    text: `Ananya Iyer\nDistributed Computing Research Assistant\n\nRESEARCH\n• Implemented a replicated log in Go to compare Raft election strategies across 50 simulated nodes.\n• Designed experiments, analyzed failure modes and co-authored a workshop paper.\n• Built reproducible environments with Ansible and documented the setup for new lab members.\n\nPROJECTS\nCreated a Go API and packaged it with Docker.\n\nSKILLS\nGo, Python, Raft, gRPC, Ansible, Docker.\n\nCOVER NOTE\nMy systems work is deep but academic. I have not deployed to a public cloud or supported production incidents.`,
  },
  {
    id: 'A-12', name: 'Om Prakash', role: 'DevOps Trainee', source: 'Bootcamp',
    text: `Om Prakash\nDevOps Trainee\n\nBOOTCAMP PROJECT\n• Deployed a sample Node.js store to Kubernetes on AWS EKS using Terraform.\n• Configured Prometheus metrics, Grafana dashboards and an alert for high error rate.\n• Used a RabbitMQ worker for email processing and documented setup steps for the cohort.\n• Load-tested the application at 300 requests per second.\n\nCERTIFICATIONS\nCKA, AWS Cloud Practitioner.\n\nCOVER NOTE\nThis was a guided eight-week team project, not production employment.`,
  },
]

// Demo-only candidate-provided salary expectations for testing a requisition cap.
// Absence remains distinct from meeting a cap in the screening agent.
const demoSalaryLpa = { 'A-01': 9, 'A-02': 7, 'A-03': 8, 'A-04': 6, 'A-05': 10, 'A-06': 8, 'A-07': 7, 'A-08': 14, 'A-09': 7, 'A-10': 9, 'A-11': 8, 'A-12': 6, 'A-13': 8, 'A-14': 7, 'A-15': 6 }
sampleCandidates.forEach((candidate) => { candidate.expectedSalaryLpa = demoSalaryLpa[candidate.id] })
