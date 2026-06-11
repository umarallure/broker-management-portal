import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Phone, Mail, MapPin, DollarSign } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface BrokerContact {
  id: string;
  submission_id: string;
  customer_full_name: string;
  phone_number: string;
  email: string;
  street_address: string;
  city: string;
  state: string;
  zip_code: string;
  date_of_birth: string;
  age: number;
  additional_notes: string;
  lead_vendor?: string;
  // Accident/Incident fields
  accident_date?: string;
  accident_location?: string;
  accident_scenario?: string;
  injuries?: string;
  medical_attention?: string;
  police_attended?: boolean;
  insured?: boolean;
  vehicle_registration?: string;
  insurance_company?: string;
  third_party_vehicle_registration?: string;
  other_party_admit_fault?: boolean;
  passengers_count?: number;
  prior_attorney_involved?: boolean;
  prior_attorney_details?: string;
  contact_name?: string;
  contact_number?: string;
  contact_address?: string;
}

interface BrokerInfoCardProps {
  broker: BrokerContact;
}

export const BrokerInfoCard = ({ broker }: BrokerInfoCardProps) => {
  const { toast } = useToast();

  const copyToClipboard = () => {
    const brokerInfo = `
Broker Contact Information:
Name: ${broker.customer_full_name}
Phone: ${broker.phone_number}
Email: ${broker.email}
Address: ${broker.street_address}, ${broker.city}, ${broker.state} ${broker.zip_code}
Date of Birth: ${broker.date_of_birth}
Age: ${broker.age}

Accident/Incident Information:
Accident Date: ${broker.accident_date || 'N/A'}
Accident Location: ${broker.accident_location || 'N/A'}
Accident Scenario: ${broker.accident_scenario || 'N/A'}
Injuries: ${broker.injuries || 'N/A'}
Medical Attention: ${broker.medical_attention || 'N/A'}
Police Attended: ${broker.police_attended ? 'Yes' : 'No'}
Insured: ${broker.insured ? 'Yes' : 'No'}
Vehicle Registration: ${broker.vehicle_registration || 'N/A'}
Insurance Company: ${broker.insurance_company || 'N/A'}
Third Party Vehicle Registration: ${broker.third_party_vehicle_registration || 'N/A'}
Other Party Admit Fault: ${broker.other_party_admit_fault ? 'Yes' : 'No'}
Passengers Count: ${broker.passengers_count || 0}
Prior Legal Representation: ${broker.prior_attorney_involved ? 'Yes' : 'No'}
Prior Representation Details: ${broker.prior_attorney_details || 'N/A'}

Witness/Contact Information:
Contact Name: ${broker.contact_name || 'N/A'}
Contact Number: ${broker.contact_number || 'N/A'}
Contact Address: ${broker.contact_address || 'N/A'}

Notes: ${broker.additional_notes}
Submission ID: ${broker.submission_id}
    `.trim();

    navigator.clipboard.writeText(brokerInfo);
    toast({
      title: "Copied!",
      description: "Broker contact information copied to clipboard",
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2">
          Broker Contact Information
        </CardTitle>
        <Button onClick={copyToClipboard} variant="outline" size="sm" className="w-full sm:w-auto">
          <Copy className="h-4 w-4 mr-2" />
          Copy Basic Info
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div>
              <h3 className="font-semibold text-lg">{broker.customer_full_name}</h3>
              <p className="text-sm text-muted-foreground">Age: {broker.age}</p>
              <p className="text-sm text-muted-foreground">DOB: {broker.date_of_birth}</p>
            </div>
            
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4" />
              <span className="break-all">{broker.phone_number}</span>
            </div>
            
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              <span className="break-all">{broker.email}</span>
            </div>
            
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 mt-1" />
              <div>
                <div>{broker.street_address}</div>
                <div>{broker.city}, {broker.state} {broker.zip_code}</div>
              </div>
            </div>
          </div>
          
          <div className="space-y-3">
            <div>
              <h4 className="font-medium">Accident Information</h4>
              {broker.accident_date && <p className="text-sm">Date: {broker.accident_date}</p>}
              {broker.accident_location && <p className="text-sm">Location: {broker.accident_location}</p>}
              {broker.injuries && <p className="text-sm">Injuries: {broker.injuries}</p>}
            </div>
          </div>
        </div>
        
        {broker.additional_notes && (
          <div className="mt-4 p-3 bg-muted rounded-lg">
            <h4 className="font-medium mb-2">Additional Notes:</h4>
            <p className="text-sm">{broker.additional_notes}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
